import { HttpStatus, Injectable } from '@nestjs/common';
import type { AccountDetail, CreateSplitRequest } from '@picanteria/shared';
import { Prisma } from '@prisma/client';
import { AppException } from '../common/app.exception';
import { lockOpenOrder } from '../orders/order-locks';
import { activeQuantity, toCents, type Viewer } from '../orders/order-mapper';
import { PrismaService } from '../prisma/prisma.service';
import { accountState, billableItems, toAccountDetail, type AccountRecord, type AccountState } from './account-mapper';
import { assertBillRequested, loadAccount } from './accounts.service';
import { BillingNotifier } from './billing-notifier';
import { assignedAmountCents, splitEqually, validateAssignment, type AssignedUnits } from './billing-math';

interface PartPlan {
  label: string;
  amountCents: number;
  items: AssignedUnits[];
}

const decimal = (amountCents: number): Prisma.Decimal => new Prisma.Decimal(amountCents).div(100);
const defaultLabel = (position: number): string => `Parte ${String(position)}`;

/** División del saldo pendiente en partes iguales o por ítems (research.md §6, FR-011, FR-013). */
@Injectable()
export class SplitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: BillingNotifier,
  ) {}

  /** Reemplaza la división vigente por una nueva sobre el saldo pendiente. */
  async createSplit(orderId: string, input: CreateSplitRequest, cashier: Viewer): Promise<AccountDetail> {
    const record = await this.prisma.$transaction(async (tx) => {
      await lockOpenOrder(tx, orderId);
      const current = await loadAccount(tx, orderId);
      assertBillRequested(current);
      const state = accountState(current);
      if (state.pendingCents <= 0) {
        throw new AppException('VALIDATION_ERROR', HttpStatus.CONFLICT, { message: 'La cuenta no tiene saldo para dividir' });
      }
      const plan = input.mode === 'EQUAL' ? planEqual(state, input.parts) : planByItems(current, state, input.parts);

      await tx.billSplit.updateMany({ where: { orderId, supersededAt: null }, data: { supersededAt: new Date() } });
      await tx.billSplit.create({
        data: {
          orderId,
          mode: input.mode,
          baseAmount: decimal(state.pendingCents),
          createdById: cashier.id,
          parts: {
            create: plan.map((part, index) => ({
              position: index + 1,
              label: part.label,
              amount: decimal(part.amountCents),
              items: { create: part.items.map((item) => ({ orderItemId: item.orderItemId, units: item.units })) },
            })),
          },
        },
      });
      return loadAccount(tx, orderId);
    });
    this.notifier.accountUpdated(record, 'SPLIT_CREATED');
    return toAccountDetail(record);
  }
}

/** Partes iguales: los céntimos sobrantes van a la parte 1 (AC-2.1). */
function planEqual(state: AccountState, parts: number): PartPlan[] {
  return splitEqually(state.pendingCents, parts).map((amountCents, index) => ({
    label: defaultLabel(index + 1),
    amountCents,
    items: [],
  }));
}

/** Por ítems: se asignan todas las unidades vigentes que aún no se pagaron (AC-2.2). */
function planByItems(
  record: AccountRecord,
  state: AccountState,
  parts: ReadonlyArray<{ label?: string | undefined; items: AssignedUnits[] }>,
): PartPlan[] {
  const available = new Map<string, number>();
  const unitPrices = new Map<string, number>();
  for (const item of billableItems(record)) {
    if (item.status === 'VOIDED' || item.unitPrice === null) continue;
    const units = activeQuantity(item) - (state.paidUnits.get(item.id) ?? 0);
    if (units <= 0) continue;
    available.set(item.id, units);
    unitPrices.set(item.id, toCents(item.unitPrice));
  }

  const check = validateAssignment(available, parts);
  if (check.unknown.length > 0 || Object.keys(check.overAssigned).length > 0) {
    throw new AppException('SPLIT_INVALID_ASSIGNMENT', HttpStatus.CONFLICT, {
      details: { unknown: check.unknown, overAssigned: check.overAssigned },
    });
  }
  if (check.unassignedTotal > 0) {
    throw new AppException('SPLIT_UNASSIGNED_UNITS', HttpStatus.CONFLICT, {
      details: { unassigned: check.unassignedTotal, items: check.unassigned },
    });
  }

  const plan = parts.map((part, index) => ({
    label: part.label || defaultLabel(index + 1),
    amountCents: assignedAmountCents(part.items, unitPrices),
    items: part.items,
  }));
  // Con pagos que no cubren unidades concretas (cobros sin dividir o partes iguales), los ítems
  // ya no suman el saldo: solo se puede repartir en partes iguales.
  if (plan.reduce((sum, part) => sum + part.amountCents, 0) !== state.pendingCents) {
    throw new AppException('SPLIT_INVALID_ASSIGNMENT', HttpStatus.CONFLICT, {
      message: 'Los ítems no suman el saldo pendiente. Divide el saldo en partes iguales.',
    });
  }
  return plan;
}
