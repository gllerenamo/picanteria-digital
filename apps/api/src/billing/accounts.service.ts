import { HttpStatus, Injectable } from '@nestjs/common';
import type { AccountDetail, AccountSummary, CreatePaymentRequest } from '@picanteria/shared';
import { Prisma, type Payment } from '@prisma/client';
import { AppException } from '../common/app.exception';
import { TablesService } from '../menu/tables.service';
import { lockOpenOrder } from '../orders/order-locks';
import { money, toCents, type Viewer } from '../orders/order-mapper';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCOUNT_INCLUDE,
  accountState,
  canCloseWithoutCharge,
  toAccountDetail,
  toAccountSummary,
  type AccountRecord,
} from './account-mapper';
import { BillingNotifier } from './billing-notifier';
import { changeCents } from './billing-math';

type Tx = Prisma.TransactionClient;

/** Montos de la petición en céntimos (el esquema ya garantiza hasta 2 decimales). */
const cents = (amount: number): number => Math.round(amount * 100);

/** Carga la cuenta de un pedido o responde 404. */
export async function loadAccount(db: Tx, orderId: string): Promise<AccountRecord> {
  const record = await db.order.findUnique({ where: { id: orderId }, include: ACCOUNT_INCLUDE });
  if (!record) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'El pedido no existe' });
  return record;
}

/** El cajero solo cobra cuando el mozo pidió la cuenta (FR-004, AC-1.6, AC-1.7). */
export function assertBillRequested(record: AccountRecord): void {
  if (record.table.status !== 'POR_COBRAR') throw new AppException('BILL_NOT_REQUESTED', HttpStatus.CONFLICT);
}

/** El reintento debe ser el mismo pago; con otro cuerpo, la clave no sirve (research.md §4). */
function isSameRequest(payment: Payment, orderId: string, input: CreatePaymentRequest): boolean {
  const received = payment.receivedAmount === null ? null : toCents(payment.receivedAmount);
  return (
    payment.orderId === orderId &&
    payment.method === input.method &&
    toCents(payment.amount) === cents(input.amount) &&
    received === (input.receivedAmount === undefined ? null : cents(input.receivedAmount)) &&
    (payment.reference ?? null) === (input.reference || null) &&
    payment.partId === (input.partId ?? null)
  );
}

interface PaymentOutcome {
  record: AccountRecord;
  /** `false` si fue un reintento: no se emite nada. */
  created: boolean;
  paidInFull: boolean;
}

/** Cuenta de la mesa, pagos, anulación de pagos y cierre sin cobro (research.md §4 y §5). */
@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tables: TablesService,
    private readonly notifier: BillingNotifier,
  ) {}

  /** Mesas por cobrar, por número de mesa (FR-001). */
  async listPending(): Promise<AccountSummary[]> {
    const records = await this.prisma.order.findMany({
      where: { status: 'OPEN', table: { status: 'POR_COBRAR' } },
      include: ACCOUNT_INCLUDE,
      orderBy: { table: { tableNumber: 'asc' } },
    });
    return records.map(toAccountSummary);
  }

  async getAccount(orderId: string): Promise<AccountDetail> {
    return toAccountDetail(await loadAccount(this.prisma, orderId));
  }

  /**
   * Registra un pago bajo el bloqueo del pedido; si el saldo llega a cero, el pedido queda
   * pagado y la mesa libre en la misma transacción (FR-004 a FR-008, FR-012).
   */
  async createPayment(orderId: string, input: CreatePaymentRequest, idempotencyKey: string, cashier: Viewer): Promise<AccountDetail> {
    let outcome: PaymentOutcome;
    try {
      outcome = await this.prisma.$transaction((tx) => this.paymentInTransaction(tx, orderId, input, idempotencyKey, cashier));
    } catch (error) {
      // Respaldo de la columna única: otro reintento simultáneo ya registró la clave.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey } });
        if (existing && isSameRequest(existing, orderId, input)) return this.getAccount(orderId);
        throw new AppException('IDEMPOTENCY_KEY_REUSED', HttpStatus.CONFLICT);
      }
      throw error;
    }

    const { record, created, paidInFull } = outcome;
    if (created) {
      if (paidInFull) this.notifier.tableFreed(record);
      this.notifier.accountUpdated(record, paidInFull ? 'PAID' : 'PAYMENT_CREATED');
    }
    return toAccountDetail(record);
  }

  private async paymentInTransaction(
    tx: Tx,
    orderId: string,
    input: CreatePaymentRequest,
    idempotencyKey: string,
    cashier: Viewer,
  ): Promise<PaymentOutcome> {
    // 1. ¿Es un reintento? Se mira antes y después del bloqueo: el pago que completó la cuenta
    //    ya cerró el pedido, y un reintento simultáneo espera al primero en el bloqueo.
    const replay = async (): Promise<PaymentOutcome | null> => {
      const existing = await tx.payment.findUnique({ where: { idempotencyKey } });
      if (!existing) return null;
      if (!isSameRequest(existing, orderId, input)) throw new AppException('IDEMPOTENCY_KEY_REUSED', HttpStatus.CONFLICT);
      return { record: await loadAccount(tx, orderId), created: false, paidInFull: false };
    };
    const before = await replay();
    if (before) return before;
    await lockOpenOrder(tx, orderId);
    const after = await replay();
    if (after) return after;

    // 2. Reglas de cobro contra el estado actual de la cuenta.
    const record = await loadAccount(tx, orderId);
    assertBillRequested(record);
    const state = accountState(record);
    if (state.splitIsStale) throw new AppException('SPLIT_STALE', HttpStatus.CONFLICT);

    const amountCents = cents(input.amount);
    if (amountCents > state.pendingCents) {
      throw new AppException('PAYMENT_EXCEEDS_BALANCE', HttpStatus.CONFLICT, {
        details: { pending: money(Math.max(state.pendingCents, 0)).formatted },
      });
    }

    if (input.partId) {
      const part = state.activeSplit?.parts.find((candidate) => candidate.id === input.partId);
      if (!part) {
        const isOld = record.splits.some((split) => split.parts.some((candidate) => candidate.id === input.partId));
        if (isOld) throw new AppException('SPLIT_STALE', HttpStatus.CONFLICT);
        throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'La parte no existe' });
      }
      const partPending = toCents(part.amount) - (state.paidByPart.get(part.id) ?? 0);
      if (amountCents > partPending) {
        throw new AppException('PAYMENT_EXCEEDS_BALANCE', HttpStatus.CONFLICT, {
          message: 'El monto supera lo que falta pagar de esta parte',
          details: { pending: money(Math.max(partPending, 0)).formatted },
        });
      }
    }

    let change: number | null = null;
    if (input.method === 'CASH') {
      change = changeCents(amountCents, cents(input.receivedAmount ?? 0));
      if (change < 0) throw new AppException('INSUFFICIENT_CASH', HttpStatus.CONFLICT);
    }

    // 3. Pago y, si cubre el saldo, cuenta pagada y mesa libre.
    await tx.payment.create({
      data: {
        orderId,
        partId: input.partId ?? null,
        method: input.method,
        amount: new Prisma.Decimal(amountCents).div(100),
        receivedAmount: input.method === 'CASH' ? new Prisma.Decimal(cents(input.receivedAmount ?? 0)).div(100) : null,
        changeAmount: change === null ? null : new Prisma.Decimal(change).div(100),
        reference: input.method === 'CASH' ? null : input.reference || null,
        idempotencyKey,
        cashierId: cashier.id,
        // Hora tomada con el bloqueo ya adquirido (como el envío de la 003).
        paidAt: new Date(),
      },
    });
    const paidInFull = amountCents === state.pendingCents;
    if (paidInFull) await this.markPaid(tx, record);
    return { record: await loadAccount(tx, orderId), created: true, paidInFull };
  }

  /** Pedido `PAID` y mesa `POR_COBRAR → LIBRE` (003 AC-6.6). */
  private async markPaid(tx: Tx, record: AccountRecord): Promise<void> {
    await tx.order.update({ where: { id: record.id }, data: { status: 'PAID', closedAt: new Date() } });
    if (!(await this.tables.transition(tx, record.table.id, ['POR_COBRAR'], 'LIBRE'))) {
      throw new AppException('BILL_NOT_REQUESTED', HttpStatus.CONFLICT);
    }
  }

  /** Anula un pago mientras la cuenta no esté pagada; queda con su motivo (FR-014, AC-2.7). */
  async voidPayment(orderId: string, paymentId: string, reason: string, cashier: Viewer): Promise<AccountDetail> {
    const record = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: paymentId, orderId }, include: { order: true } });
      if (!payment) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'El pago no existe' });
      if (payment.order.status !== 'OPEN') throw new AppException('PAYMENT_NOT_VOIDABLE', HttpStatus.CONFLICT);
      await lockOpenOrder(tx, orderId);
      const { count } = await tx.payment.updateMany({
        where: { id: paymentId, status: 'VALID' },
        data: { status: 'VOIDED', voidReason: reason, voidedById: cashier.id, voidedAt: new Date() },
      });
      if (count === 0) throw new AppException('PAYMENT_NOT_VOIDABLE', HttpStatus.CONFLICT);
      return loadAccount(tx, orderId);
    });
    this.notifier.accountUpdated(record, 'PAYMENT_VOIDED');
    return toAccountDetail(record);
  }

  /** Cuenta por cobrar sin saldo (todo anulado): pagada sin pagos y mesa libre (FR-009). */
  async closeWithoutCharge(orderId: string): Promise<AccountDetail> {
    const record = await this.prisma.$transaction(async (tx) => {
      await lockOpenOrder(tx, orderId);
      const current = await loadAccount(tx, orderId);
      assertBillRequested(current);
      if (!canCloseWithoutCharge(current, accountState(current))) {
        throw new AppException('ACCOUNT_HAS_BALANCE', HttpStatus.CONFLICT);
      }
      await this.markPaid(tx, current);
      return loadAccount(tx, orderId);
    });
    this.notifier.tableFreed(record);
    this.notifier.accountUpdated(record, 'CLOSED_WITHOUT_CHARGE');
    return toAccountDetail(record);
  }
}
