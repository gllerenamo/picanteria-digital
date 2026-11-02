import { randomUUID } from 'node:crypto';
import { IDEMPOTENCY_KEY_HEADER, type CreatePaymentRequest } from '@picanteria/shared';
import type { DiningTable, MenuItem, Order, OrderItem, TableStatus } from '@prisma/client';
import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createDispatch, createMenuItem, createOpenOrder, createSentItem } from './order-factories';

/** Fábricas de la 005: pedidos cobrables armados con las fábricas de la 003. */

export interface BillableItemInput {
  name?: string;
  price: number;
  quantity: number;
  voidedQuantity?: number;
  /** Plato ya creado (para repetirlo en varias cuentas, por ejemplo en los reportes). */
  menuItem?: MenuItem;
}

export interface BillableOrder {
  table: DiningTable;
  order: Order;
  items: OrderItem[];
  menuItems: MenuItem[];
}

/**
 * Pedido abierto con la mesa por cobrar (o en el estado indicado) y sus ítems enviados en un
 * único envío. Un ítem con todas sus unidades anuladas queda `VOIDED`, como lo deja la 003.
 */
export async function createBillableOrder(
  prisma: PrismaService,
  input: { waiterId: string; tableNumber?: number; tableStatus?: TableStatus; items: BillableItemInput[] },
): Promise<BillableOrder> {
  const { table, order } = await createOpenOrder(prisma, input.waiterId, {
    tableNumber: input.tableNumber,
    tableStatus: input.tableStatus ?? 'POR_COBRAR',
  });
  const dispatch = await createDispatch(prisma, order.id, input.waiterId);
  const items: OrderItem[] = [];
  const menuItems: MenuItem[] = [];
  for (const item of input.items) {
    const menuItem =
      item.menuItem ?? (await createMenuItem(prisma, { ...(item.name ? { name: item.name } : {}), price: item.price }));
    const voidedQuantity = item.voidedQuantity ?? 0;
    const created = await createSentItem(prisma, dispatch, menuItem, {
      quantity: item.quantity,
      voidedQuantity,
      status: voidedQuantity === item.quantity ? 'VOIDED' : 'PENDING',
    });
    // El precio de envío puede diferir del precio actual del plato (AC-5.4).
    items.push(
      item.menuItem && toCentsNumber(item.menuItem.price) !== Math.round(item.price * 100)
        ? await prisma.orderItem.update({ where: { id: created.id }, data: { unitPrice: item.price } })
        : created,
    );
    menuItems.push(menuItem);
  }
  return { table, order, items, menuItems };
}

const toCentsNumber = (value: { toString(): string }): number => Math.round(Number(value.toString()) * 100);

/** Registra un pago con su cabecera `Idempotency-Key` (una nueva por defecto). */
export function pay(agent: TestAgent, orderId: string, body: CreatePaymentRequest, key: string = randomUUID()) {
  return agent.post(`/api/billing/accounts/${orderId}/payments`).set(IDEMPOTENCY_KEY_HEADER, key).send(body);
}

/** Paga la cuenta directo en la base (reportes): pedido `PAID` con `closedAt` y sus pagos vigentes. */
export async function markPaid(
  prisma: PrismaService,
  input: {
    order: Order;
    cashierId: string;
    closedAt: Date;
    payments: Array<{ method: 'CASH' | 'YAPE_PLIN' | 'CARD'; amount: number; status?: 'VALID' | 'VOIDED' }>;
  },
): Promise<void> {
  await prisma.order.update({ where: { id: input.order.id }, data: { status: 'PAID', closedAt: input.closedAt } });
  await prisma.diningTable.update({ where: { id: input.order.tableId }, data: { status: 'LIBRE' } });
  for (const payment of input.payments) {
    await prisma.payment.create({
      data: {
        orderId: input.order.id,
        method: payment.method,
        amount: payment.amount,
        receivedAmount: payment.method === 'CASH' ? payment.amount : null,
        changeAmount: payment.method === 'CASH' ? 0 : null,
        idempotencyKey: randomUUID(),
        cashierId: input.cashierId,
        paidAt: input.closedAt,
        status: payment.status ?? 'VALID',
      },
    });
  }
}
