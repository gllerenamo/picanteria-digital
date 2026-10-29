import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
  DiningTable,
  KitchenDispatch,
  MenuItem,
  Order,
  OrderItem,
  OrderItemStatus,
  TableStatus,
} from '@prisma/client';
import { TablesService } from '../../src/menu/tables.service';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { RealtimeGateway } from '../../src/realtime/realtime.gateway';

/** Fábricas de la 003: insertan directo con Prisma para preparar cada escenario. */

let counter = 0;
const next = (): number => {
  counter += 1;
  return counter;
};

export function createTable(
  prisma: PrismaService,
  overrides: { tableNumber?: number; status?: TableStatus; capacity?: number } = {},
): Promise<DiningTable> {
  return prisma.diningTable.create({
    data: {
      tableNumber: overrides.tableNumber ?? 100 + next(),
      capacity: overrides.capacity ?? 4,
      status: overrides.status ?? 'LIBRE',
    },
  });
}

export async function createMenuItem(
  prisma: PrismaService,
  overrides: { name?: string; price?: number; isAvailable?: boolean; isActive?: boolean } = {},
): Promise<MenuItem> {
  const category = await prisma.menuCategory.create({ data: { name: `Categoría ${next()}` } });
  return prisma.menuItem.create({
    data: {
      categoryId: category.id,
      name: overrides.name ?? `Plato ${next()}`,
      price: overrides.price ?? 24.5,
      isAvailable: overrides.isAvailable ?? true,
      isActive: overrides.isActive ?? true,
    },
  });
}

/** Pedido abierto con su mesa ocupada (o en el estado indicado). */
export async function createOpenOrder(
  prisma: PrismaService,
  waiterId: string,
  overrides: { tableNumber?: number; tableStatus?: TableStatus; guestCount?: number | null } = {},
): Promise<{ table: DiningTable; order: Order }> {
  const table = await createTable(prisma, {
    tableNumber: overrides.tableNumber,
    status: overrides.tableStatus ?? 'OCUPADA',
  });
  const order = await prisma.order.create({
    data: { tableId: table.id, waiterId, guestCount: overrides.guestCount ?? null },
  });
  return { table, order };
}

export function createDraftItem(
  prisma: PrismaService,
  orderId: string,
  menuItemId: string,
  overrides: { quantity?: number; notes?: string | null } = {},
): Promise<OrderItem> {
  return prisma.orderItem.create({
    data: { orderId, menuItemId, quantity: overrides.quantity ?? 1, notes: overrides.notes ?? null },
  });
}

/** Envío con su número correlativo y ronda (por defecto, el siguiente libre). */
export async function createDispatch(
  prisma: PrismaService,
  orderId: string,
  sentById: string,
  overrides: { sequence?: number; round?: number } = {},
): Promise<KitchenDispatch> {
  const last = await prisma.kitchenDispatch.aggregate({ _max: { sequence: true } });
  const rounds = await prisma.kitchenDispatch.count({ where: { orderId } });
  return prisma.kitchenDispatch.create({
    data: {
      orderId,
      sentById,
      sequence: overrides.sequence ?? (last._max.sequence ?? 0) + 1,
      round: overrides.round ?? rounds + 1,
      idempotencyKey: randomUUID(),
    },
  });
}

/** Ítem ya enviado en un envío, con su precio fijado. */
export function createSentItem(
  prisma: PrismaService,
  dispatch: KitchenDispatch,
  menuItem: MenuItem,
  overrides: { quantity?: number; voidedQuantity?: number; status?: Exclude<OrderItemStatus, 'DRAFT'>; notes?: string | null } = {},
): Promise<OrderItem> {
  return prisma.orderItem.create({
    data: {
      orderId: dispatch.orderId,
      dispatchId: dispatch.id,
      menuItemId: menuItem.id,
      quantity: overrides.quantity ?? 1,
      voidedQuantity: overrides.voidedQuantity ?? 0,
      unitPrice: menuItem.price,
      notes: overrides.notes ?? null,
      status: overrides.status ?? 'PENDING',
    },
  });
}

/**
 * Hace lo que hará Caja (005) al cobrar: mesa `POR_COBRAR → LIBRE` y pedido `PAID` en una
 * transacción, y después el evento `orders:table-status-changed` (research.md §16). La prueba de
 * cobro de la 005 reemplazará a este sustituto.
 */
export async function simulateCashierPayment(app: NestExpressApplication, prisma: PrismaService, orderId: string): Promise<void> {
  const tables = app.get(TablesService);
  const realtime = app.get(RealtimeGateway);
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { table: true } });
    const changed = await tables.transition(tx, current.tableId, ['POR_COBRAR'], 'LIBRE');
    if (!changed) throw new Error(`La mesa ${current.table.tableNumber} no estaba por cobrar`);
    await tx.order.update({ where: { id: orderId }, data: { status: 'PAID', closedAt: new Date() } });
    return current;
  });
  realtime.emitToRoles(['WAITER', 'CASHIER'], 'orders:table-status-changed', {
    tableId: order.tableId,
    tableNumber: order.table.tableNumber,
    status: 'LIBRE',
    orderId,
    changedAt: new Date().toISOString(),
  });
}
