import type {
  Money,
  OrderDetail,
  OrderItemResponse,
  OrderItemStatus,
  OrderStatus,
  Role,
  TableOverview,
  TableStatus,
} from '@picanteria/shared';
import type { Prisma } from '@prisma/client';

/** Respuestas de la API de pedidos a partir de las filas de Prisma (data-model.md §3). */

export const ORDER_ITEM_INCLUDE = {
  menuItem: { select: { id: true, name: true, price: true, isAvailable: true, isActive: true } },
  dispatch: { select: { sequence: true } },
  voids: {
    include: { voidedBy: { select: { id: true, fullName: true } } },
    orderBy: { voidedAt: 'asc' },
  },
} satisfies Prisma.OrderItemInclude;

export const ORDER_DETAIL_INCLUDE = {
  table: { select: { id: true, tableNumber: true, status: true } },
  waiter: { select: { id: true, fullName: true } },
  items: { include: ORDER_ITEM_INCLUDE, orderBy: { createdAt: 'asc' } },
  dispatches: {
    include: { sentBy: { select: { id: true, fullName: true } } },
    orderBy: { sequence: 'asc' },
  },
} satisfies Prisma.OrderInclude;

export const TABLE_OVERVIEW_INCLUDE = {
  orders: {
    where: { status: 'OPEN' },
    include: {
      waiter: { select: { id: true, fullName: true } },
      items: { where: { status: 'DRAFT' }, select: { id: true }, take: 1 },
    },
  },
} satisfies Prisma.DiningTableInclude;

export type OrderItemRecord = Prisma.OrderItemGetPayload<{ include: typeof ORDER_ITEM_INCLUDE }>;
export type OrderDetailRecord = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;
export type TableOverviewRecord = Prisma.DiningTableGetPayload<{ include: typeof TABLE_OVERVIEW_INCLUDE }>;

/** Quien consulta: decide si puede cancelar la apertura. */
export interface Viewer {
  id: string;
  role: Role;
}

// ---------------------------------------------------------------------------
// Cálculos (sin acceso a datos; probados en order-mapper.spec.ts)

/** Montos en céntimos para no acumular errores de punto flotante. */
export function toCents(amount: Prisma.Decimal | number): number {
  return Math.round(Number(amount) * 100);
}

export function money(cents: number): Money {
  const amount = cents / 100;
  return { amount, formatted: `S/ ${amount.toFixed(2)}` };
}

export function activeQuantity(item: { quantity: number; voidedQuantity: number }): number {
  return item.quantity - item.voidedQuantity;
}

export interface ConsumptionLine {
  status: OrderItemStatus;
  quantity: number;
  voidedQuantity: number;
  unitPriceCents: number | null;
}

/** Ítems enviados que cuentan para la cuenta: ni borradores ni anulados del todo. */
function isBillable(line: ConsumptionLine): boolean {
  return line.status !== 'DRAFT' && line.status !== 'VOIDED' && activeQuantity(line) > 0;
}

/** Consumo de la mesa: unidades vigentes de los ítems enviados no anulados (FR-035). */
export function consumptionCents(lines: readonly ConsumptionLine[]): number {
  return lines
    .filter(isBillable)
    .reduce((total, line) => total + (line.unitPriceCents ?? 0) * activeQuantity(line), 0);
}

/** Se puede cancelar la apertura: pedido abierto, sin envíos, y quien pide es el responsable o un administrador (FR-006). */
export function canCancelOrder(input: {
  orderStatus: OrderStatus;
  dispatchCount: number;
  waiterId: string;
  viewer: Viewer;
}): boolean {
  return (
    input.orderStatus === 'OPEN' &&
    input.dispatchCount === 0 &&
    (input.viewer.id === input.waiterId || input.viewer.role === 'ADMIN')
  );
}

/** Se puede pedir la cuenta: mesa ocupada, sin ítems por enviar y con consumo (FR-033). */
export function canRequestBill(input: {
  orderStatus: OrderStatus;
  tableStatus: TableStatus;
  lines: readonly ConsumptionLine[];
}): boolean {
  return (
    input.orderStatus === 'OPEN' &&
    input.tableStatus === 'OCUPADA' &&
    !input.lines.some((line) => line.status === 'DRAFT') &&
    input.lines.some(isBillable)
  );
}

// ---------------------------------------------------------------------------
// Respuestas

function toLine(item: OrderItemRecord): ConsumptionLine {
  return {
    status: item.status,
    quantity: item.quantity,
    voidedQuantity: item.voidedQuantity,
    unitPriceCents: item.unitPrice === null ? null : toCents(item.unitPrice),
  };
}

export function toOrderItem(item: OrderItemRecord): OrderItemResponse {
  const unitPriceCents = item.unitPrice === null ? null : toCents(item.unitPrice);
  const isDraft = item.status === 'DRAFT';
  return {
    id: item.id,
    menuItem: { id: item.menuItem.id, name: item.menuItem.name },
    quantity: item.quantity,
    voidedQuantity: item.voidedQuantity,
    activeQuantity: activeQuantity(item),
    notes: item.notes,
    status: item.status,
    dispatchId: item.dispatchId,
    unitPrice: unitPriceCents === null ? null : money(unitPriceCents),
    subtotal: unitPriceCents === null ? null : money(unitPriceCents * activeQuantity(item)),
    currentPrice: isDraft ? money(toCents(item.menuItem.price)) : null,
    isAvailable: isDraft ? item.menuItem.isAvailable && item.menuItem.isActive : null,
    voids: item.voids.map((itemVoid) => ({
      id: itemVoid.id,
      units: itemVoid.units,
      reason: itemVoid.reason,
      voidedBy: itemVoid.voidedBy,
      voidedAt: itemVoid.voidedAt.toISOString(),
    })),
  };
}

/** Primero los ítems por enviar; luego los enviados, por número de envío. */
function compareItems(a: OrderItemRecord, b: OrderItemRecord): number {
  const sequenceA = a.dispatch?.sequence ?? 0;
  const sequenceB = b.dispatch?.sequence ?? 0;
  if (sequenceA !== sequenceB) return sequenceA - sequenceB;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export function toOrderDetail(order: OrderDetailRecord, viewer: Viewer): OrderDetail {
  const lines = order.items.map(toLine);
  return {
    id: order.id,
    status: order.status,
    table: order.table,
    waiter: order.waiter,
    guestCount: order.guestCount,
    openedAt: order.createdAt.toISOString(),
    closedAt: order.closedAt?.toISOString() ?? null,
    items: [...order.items].sort(compareItems).map(toOrderItem),
    dispatches: order.dispatches.map((dispatch) => ({
      id: dispatch.id,
      sequence: dispatch.sequence,
      round: dispatch.round,
      sentBy: dispatch.sentBy,
      sentAt: dispatch.sentAt.toISOString(),
    })),
    consumption: { total: money(consumptionCents(lines)) },
    canCancel: canCancelOrder({
      orderStatus: order.status,
      dispatchCount: order.dispatches.length,
      waiterId: order.waiter.id,
      viewer,
    }),
    canRequestBill: canRequestBill({ orderStatus: order.status, tableStatus: order.table.status, lines }),
  };
}

export function toTableOverview(table: TableOverviewRecord): TableOverview {
  const open = table.orders[0];
  return {
    id: table.id,
    tableNumber: table.tableNumber,
    capacity: table.capacity,
    status: table.status,
    order: open
      ? {
          id: open.id,
          waiter: open.waiter,
          guestCount: open.guestCount,
          openedAt: open.createdAt.toISOString(),
          hasUnsentItems: open.items.length > 0,
        }
      : null,
  };
}
