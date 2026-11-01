import type { AccountDetail, AccountItem, AccountSummary, BillPart, Payment } from '@picanteria/shared';
import type { Prisma } from '@prisma/client';
import { activeQuantity, consumptionCents, money, ORDER_ITEM_INCLUDE, toCents } from '../orders/order-mapper';
import { isSplitStale } from './billing-math';

/**
 * La cuenta no es una tabla: se calcula a partir del pedido de la 003, sus pagos y su división
 * vigente (research.md §2). Mozo y cajero ven el mismo total porque ambos usan `consumptionCents`.
 */

const USER_REF = { select: { id: true, fullName: true } } as const;

export const ACCOUNT_INCLUDE = {
  table: { select: { id: true, tableNumber: true, status: true } },
  waiter: USER_REF,
  items: { include: ORDER_ITEM_INCLUDE, orderBy: { createdAt: 'asc' } },
  payments: { include: { cashier: USER_REF, voidedBy: USER_REF }, orderBy: { paidAt: 'asc' } },
  // Todas las divisiones: las partes pagadas de una división reemplazada siguen cubriendo sus unidades.
  splits: {
    include: {
      parts: {
        include: { items: { include: { orderItem: { select: { menuItem: { select: { name: true } } } } } } },
        orderBy: { position: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.OrderInclude;

export type AccountRecord = Prisma.OrderGetPayload<{ include: typeof ACCOUNT_INCLUDE }>;
type PartRecord = AccountRecord['splits'][number]['parts'][number];
type ItemRecord = AccountRecord['items'][number];

/** Estado de la cuenta en céntimos, para las reglas de cobro de los servicios. */
export interface AccountState {
  totalCents: number;
  paidCents: number;
  pendingCents: number;
  /** División vigente (sin `supersededAt`), si hay. */
  activeSplit: AccountRecord['splits'][number] | null;
  splitIsStale: boolean;
  /** Pagado por parte (solo pagos vigentes). */
  paidByPart: ReadonlyMap<string, number>;
  /** Unidades de cada ítem cubiertas por partes ya pagadas. */
  paidUnits: ReadonlyMap<string, number>;
}

const unitPriceCents = (item: ItemRecord): number => (item.unitPrice === null ? 0 : toCents(item.unitPrice));

/** Ítems que muestra la cuenta: los enviados, incluidos los anulados del todo (AC-1.2). */
export function billableItems(record: AccountRecord): ItemRecord[] {
  return record.items.filter((item) => item.status !== 'DRAFT');
}

export function partIsPaid(part: Pick<PartRecord, 'id' | 'amount'>, paidByPart: ReadonlyMap<string, number>): boolean {
  return (paidByPart.get(part.id) ?? 0) >= toCents(part.amount);
}

export function accountState(record: AccountRecord): AccountState {
  const totalCents = consumptionCents(
    record.items.map((item) => ({
      status: item.status,
      quantity: item.quantity,
      voidedQuantity: item.voidedQuantity,
      unitPriceCents: item.unitPrice === null ? null : toCents(item.unitPrice),
    })),
  );
  const valid = record.payments.filter((payment) => payment.status === 'VALID');
  const paidCents = valid.reduce((sum, payment) => sum + toCents(payment.amount), 0);

  const paidByPart = new Map<string, number>();
  for (const payment of valid) {
    if (payment.partId) paidByPart.set(payment.partId, (paidByPart.get(payment.partId) ?? 0) + toCents(payment.amount));
  }

  const paidUnits = new Map<string, number>();
  for (const split of record.splits) {
    for (const part of split.parts) {
      if (!partIsPaid(part, paidByPart)) continue;
      for (const partItem of part.items) {
        paidUnits.set(partItem.orderItemId, (paidUnits.get(partItem.orderItemId) ?? 0) + partItem.units);
      }
    }
  }

  const activeSplit = record.splits.find((split) => split.supersededAt === null) ?? null;
  let splitIsStale = false;
  if (activeSplit) {
    const partIds = new Set(activeSplit.parts.map((part) => part.id));
    const paidOutside = valid
      .filter((payment) => payment.partId === null || !partIds.has(payment.partId))
      .reduce((sum, payment) => sum + toCents(payment.amount), 0);
    splitIsStale = isSplitStale(totalCents, toCents(activeSplit.baseAmount), paidOutside);
  }

  return { totalCents, paidCents, pendingCents: totalCents - paidCents, activeSplit, splitIsStale, paidByPart, paidUnits };
}

/** Se puede cobrar: pedido abierto, mesa por cobrar, saldo y división al día (FR-004, AC-1.7, AC-2.6). */
export function canCharge(record: AccountRecord, state: AccountState): boolean {
  return (
    record.status === 'OPEN' && record.table.status === 'POR_COBRAR' && state.pendingCents > 0 && !state.splitIsStale
  );
}

/** Se cierra sin cobro una cuenta por cobrar sin saldo (todo anulado, FR-009). */
export function canCloseWithoutCharge(record: AccountRecord, state: AccountState): boolean {
  return record.status === 'OPEN' && record.table.status === 'POR_COBRAR' && state.pendingCents <= 0;
}

/** Ítems enviados en orden de envío. */
function compareItems(a: ItemRecord, b: ItemRecord): number {
  const sequenceA = a.dispatch?.sequence ?? 0;
  const sequenceB = b.dispatch?.sequence ?? 0;
  if (sequenceA !== sequenceB) return sequenceA - sequenceB;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

function toAccountItem(item: ItemRecord, paidUnits: ReadonlyMap<string, number>): AccountItem {
  const price = unitPriceCents(item);
  // Un ítem anulado del todo puede guardar unidades sin anular en voidedQuantity < quantity.
  const active = item.status === 'VOIDED' ? 0 : activeQuantity(item);
  return {
    orderItemId: item.id,
    menuItem: { id: item.menuItem.id, name: item.menuItem.name },
    quantity: item.quantity,
    voidedQuantity: item.quantity - active,
    activeQuantity: active,
    unitPrice: money(price),
    subtotal: money(price * active),
    paidUnits: paidUnits.get(item.id) ?? 0,
  };
}

function toPayment(payment: AccountRecord['payments'][number]): Payment {
  return {
    id: payment.id,
    method: payment.method,
    amount: money(toCents(payment.amount)),
    receivedAmount: payment.receivedAmount === null ? null : money(toCents(payment.receivedAmount)),
    changeAmount: payment.changeAmount === null ? null : money(toCents(payment.changeAmount)),
    reference: payment.reference,
    partId: payment.partId,
    cashier: payment.cashier,
    paidAt: payment.paidAt.toISOString(),
    status: payment.status,
    voidReason: payment.voidReason,
    voidedBy: payment.voidedBy,
  };
}

function toBillPart(part: PartRecord, paidByPart: ReadonlyMap<string, number>): BillPart {
  const amount = toCents(part.amount);
  const paid = paidByPart.get(part.id) ?? 0;
  return {
    id: part.id,
    position: part.position,
    label: part.label,
    amount: money(amount),
    paid: money(paid),
    pending: money(Math.max(amount - paid, 0)),
    items: part.items.map((partItem) => ({
      orderItemId: partItem.orderItemId,
      name: partItem.orderItem.menuItem.name,
      units: partItem.units,
    })),
  };
}

export function toAccountDetail(record: AccountRecord): AccountDetail {
  const state = accountState(record);
  return {
    orderId: record.id,
    orderStatus: record.status,
    table: record.table,
    waiter: record.waiter,
    items: billableItems(record)
      .sort(compareItems)
      .map((item) => toAccountItem(item, state.paidUnits)),
    total: money(state.totalCents),
    paid: money(state.paidCents),
    pending: money(state.pendingCents),
    payments: record.payments.map(toPayment),
    split: state.activeSplit
      ? {
          id: state.activeSplit.id,
          mode: state.activeSplit.mode,
          isStale: state.splitIsStale,
          parts: state.activeSplit.parts.map((part) => toBillPart(part, state.paidByPart)),
        }
      : null,
    canCharge: canCharge(record, state),
    canCloseWithoutCharge: canCloseWithoutCharge(record, state),
  };
}

export function toAccountSummary(record: AccountRecord): AccountSummary {
  const state = accountState(record);
  return {
    orderId: record.id,
    tableNumber: record.table.tableNumber,
    tableStatus: record.table.status,
    waiter: record.waiter,
    total: money(state.totalCents),
    paid: money(state.paidCents),
    pending: money(state.pendingCents),
  };
}
