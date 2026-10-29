import type { DiningTable, KitchenDispatch, Order, OrderItem, OrderItemStatus } from '@prisma/client';
import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createDispatch, createMenuItem, createOpenOrder, createSentItem } from './order-factories';

/** Fábricas de la 004: comandas (envíos con sus ítems) sobre las fábricas de la 003. */

export interface ItemSpec {
  name?: string;
  quantity?: number;
  voidedQuantity?: number;
  notes?: string | null;
  status?: Exclude<OrderItemStatus, 'DRAFT'>;
}

export interface RoundSpec {
  /** Por defecto, quien abrió la mesa. */
  sentById?: string;
  sequence?: number;
  items?: ItemSpec[];
}

export interface Round {
  dispatch: KitchenDispatch;
  items: OrderItem[];
}

/** Agrega una ronda (envío) a un pedido abierto. */
export async function addRound(prisma: PrismaService, order: Order, spec: RoundSpec = {}): Promise<Round> {
  const dispatch = await createDispatch(prisma, order.id, spec.sentById ?? order.waiterId, { sequence: spec.sequence });
  const items: OrderItem[] = [];
  for (const item of spec.items ?? [{}]) {
    const menuItem = await createMenuItem(prisma, { name: item.name });
    items.push(await createSentItem(prisma, dispatch, menuItem, item));
  }
  return { dispatch, items };
}

/** Mesa abierta por `waiterId` con una primera ronda ya enviada a cocina. */
export async function createTicket(
  prisma: PrismaService,
  waiterId: string,
  spec: RoundSpec & { tableNumber?: number } = {},
): Promise<Round & { table: DiningTable; order: Order }> {
  const { table, order } = await createOpenOrder(prisma, waiterId, { tableNumber: spec.tableNumber });
  return { table, order, ...(await addRound(prisma, order, spec)) };
}

/** Pasos de cocina por la API, como los da la pantalla. */
export function advance(agent: TestAgent, itemId: string, from: 'PENDING' | 'PREPARING') {
  return agent.post(`/api/kitchen/items/${itemId}/advance`).send({ from });
}

export function undo(agent: TestAgent, itemId: string, from: 'PREPARING' | 'READY') {
  return agent.post(`/api/kitchen/items/${itemId}/undo`).send({ from });
}

/** Anulación del administrador por el endpoint de la 003 (`POST /order-items/:id/voids`). */
export function voidUnits(admin: TestAgent, itemId: string, units: number) {
  return admin.post(`/api/order-items/${itemId}/voids`).send({ units, reason: 'El cliente cambió de opinión' }).expect(201);
}
