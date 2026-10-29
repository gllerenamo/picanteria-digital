import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { DispatchResponse, OrderDetail } from '@picanteria/shared';
import type { User } from '@prisma/client';
import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { createUser, loginAs } from '../helpers/factories';
import { createDispatch, createDraftItem, createMenuItem, createOpenOrder, createSentItem } from '../helpers/order-factories';

describe('Feature 003 — US3: enviar el pedido a cocina por rondas', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let juan: User & { password: string };
  let rosa: User & { password: string };
  let juanAgent: TestAgent;
  let rosaAgent: TestAgent;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = prismaOf(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    juan = await createUser(prisma, { role: 'WAITER', fullName: 'Juan Mamani' });
    rosa = await createUser(prisma, { role: 'WAITER', fullName: 'Rosa Quispe' });
    juanAgent = await loginAs(app, juan);
    rosaAgent = await loginAs(app, rosa);
  });

  const send = (agent: TestAgent, orderId: string, key: string = randomUUID()) =>
    agent.post(`/api/orders/${orderId}/dispatches`).set('Idempotency-Key', key);

  const detail = async (orderId: string): Promise<OrderDetail> =>
    (await juanAgent.get(`/api/orders/${orderId}`).expect(200)).body as OrderDetail;

  it('[003] AC-3.1: el envío registra mesa, mozo, hora, cantidades y notas, y fija el precio (FR-025)', async () => {
    const { order, table } = await createOpenOrder(prisma, juan.id);
    const rocoto = await createMenuItem(prisma, { name: 'Rocoto Relleno', price: 24.5 });
    await createDraftItem(prisma, order.id, rocoto.id, { quantity: 2, notes: 'sin ají' });

    const dispatch = (await send(juanAgent, order.id).expect(201)).body as DispatchResponse;

    expect(dispatch).toMatchObject({ sequence: 1, round: 1, tableNumber: table.tableNumber, sentBy: { id: juan.id } });
    expect(Date.parse(dispatch.sentAt)).not.toBeNaN();
    expect(dispatch.items).toHaveLength(1);
    expect(dispatch.items[0]).toMatchObject({
      status: 'PENDING',
      quantity: 2,
      notes: 'sin ají',
      unitPrice: { formatted: 'S/ 24.50' },
    });

    await prisma.menuItem.update({ where: { id: rocoto.id }, data: { price: 30 } });
    expect((await detail(order.id)).items[0]?.unitPrice?.formatted).toBe('S/ 24.50');
  });

  it('[003] AC-3.3: la segunda ronda lleva solo lo nuevo', async () => {
    const { order } = await createOpenOrder(prisma, juan.id);
    const menuItem = await createMenuItem(prisma);
    await createDraftItem(prisma, order.id, menuItem.id);
    await send(juanAgent, order.id).expect(201);
    await createDraftItem(prisma, order.id, menuItem.id, { notes: 'uno' });
    await createDraftItem(prisma, order.id, menuItem.id, { notes: 'dos' });

    const second = (await send(juanAgent, order.id).expect(201)).body as DispatchResponse;

    expect(second.round).toBe(2);
    expect(second.items.map((item) => item.notes)).toEqual(['uno', 'dos']);
  });

  it('[003] AC-3.4: sin ítems nuevos no se registra ningún envío', async () => {
    const { order } = await createOpenOrder(prisma, juan.id);

    const body: unknown = (await send(juanAgent, order.id).expect(409)).body;

    expect(body).toMatchObject({ code: 'NOTHING_TO_SEND', message: 'No hay nada nuevo que enviar' });
    expect(await prisma.kitchenDispatch.count()).toBe(0);
  });

  it('[003] AC-3.5: si un plato se agotó, no se envía nada y se indica cuál; al quitarlo, sale', async () => {
    const { order } = await createOpenOrder(prisma, juan.id);
    const chupe = await createMenuItem(prisma, { name: 'Chupe de Camarones' });
    const adobo = await createMenuItem(prisma, { name: 'Adobo' });
    const soldOut = await createDraftItem(prisma, order.id, chupe.id);
    await createDraftItem(prisma, order.id, adobo.id);
    await prisma.menuItem.update({ where: { id: chupe.id }, data: { isAvailable: false } });

    const body: unknown = (await send(juanAgent, order.id).expect(409)).body;

    expect(body).toMatchObject({
      code: 'ITEMS_UNAVAILABLE',
      details: { items: [{ orderItemId: soldOut.id, menuItemId: chupe.id, name: 'Chupe de Camarones' }] },
    });
    expect(await prisma.kitchenDispatch.count()).toBe(0);
    expect(await prisma.orderItem.count({ where: { status: 'DRAFT' } })).toBe(2);

    await juanAgent.delete(`/api/order-items/${soldOut.id}`).expect(204);
    const dispatch = (await send(juanAgent, order.id).expect(201)).body as DispatchResponse;
    expect(dispatch.items.map((item) => item.menuItem.name)).toEqual(['Adobo']);
  });

  it('[003] AC-3.6: los envíos simultáneos de varias mesas quedan en orden de confirmación, sin huecos (SC-002)', async () => {
    const menuItem = await createMenuItem(prisma);
    const orders = [];
    for (let i = 0; i < 10; i++) {
      const { order } = await createOpenOrder(prisma, i % 2 === 0 ? juan.id : rosa.id);
      await createDraftItem(prisma, order.id, menuItem.id);
      orders.push(order);
    }

    const responses = await Promise.all(orders.map((order, i) => send(i % 2 === 0 ? juanAgent : rosaAgent, order.id)));

    expect(responses.map((response) => response.status)).toEqual(Array<number>(10).fill(201));
    const dispatches = await prisma.kitchenDispatch.findMany({ orderBy: { sequence: 'asc' } });
    expect(dispatches.map((dispatch) => dispatch.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const times = dispatches.map((dispatch) => dispatch.sentAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('[003] AC-3.7: un ítem enviado no se cambia ni se quita', async () => {
    const { order } = await createOpenOrder(prisma, juan.id);
    const menuItem = await createMenuItem(prisma);
    const sent = await createSentItem(prisma, await createDispatch(prisma, order.id, juan.id), menuItem);

    for (const response of [
      await juanAgent.patch(`/api/order-items/${sent.id}`).send({ quantity: 5 }).expect(409),
      await juanAgent.delete(`/api/order-items/${sent.id}`).expect(409),
    ]) {
      expect(response.body).toMatchObject({ code: 'ITEM_ALREADY_SENT' });
    }
  });

  it('[003] AC-3.9: reintentar con la misma clave no duplica el envío (SC-001)', async () => {
    const { order } = await createOpenOrder(prisma, juan.id);
    const menuItem = await createMenuItem(prisma);
    await createDraftItem(prisma, order.id, menuItem.id);
    const key = randomUUID();

    const first = (await send(juanAgent, order.id, key).expect(201)).body as DispatchResponse;
    const retry = (await send(juanAgent, order.id, key).expect(201)).body as DispatchResponse;
    expect(retry.id).toBe(first.id);

    // Dos toques simultáneos con la misma clave: un solo envío.
    await createDraftItem(prisma, order.id, menuItem.id);
    const sameKey = randomUUID();
    const [a, b] = await Promise.all([send(juanAgent, order.id, sameKey), send(juanAgent, order.id, sameKey)]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect((a.body as DispatchResponse).id).toBe((b.body as DispatchResponse).id);
    expect(await prisma.kitchenDispatch.count()).toBe(2);

    const { order: other } = await createOpenOrder(prisma, juan.id);
    await createDraftItem(prisma, other.id, menuItem.id);
    const body: unknown = (await send(juanAgent, other.id, key).expect(409)).body;
    expect(body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('[003] AC-3.10: otro mozo envía en una mesa ajena; queda registrado y el responsable no cambia', async () => {
    const { order } = await createOpenOrder(prisma, juan.id);
    await createDraftItem(prisma, order.id, (await createMenuItem(prisma)).id);

    const dispatch = (await send(rosaAgent, order.id).expect(201)).body as DispatchResponse;

    expect(dispatch.sentBy.id).toBe(rosa.id);
    expect((await detail(order.id)).waiter.id).toBe(juan.id);
  });

  it('sin la cabecera Idempotency-Key, o con un valor que no es UUID, responde 400', async () => {
    const { order } = await createOpenOrder(prisma, juan.id);
    await createDraftItem(prisma, order.id, (await createMenuItem(prisma)).id);

    const missing: unknown = (await juanAgent.post(`/api/orders/${order.id}/dispatches`).expect(400)).body;
    expect(missing).toMatchObject({ code: 'VALIDATION_ERROR', details: { 'Idempotency-Key': 'Falta la clave de envío' } });
    await send(juanAgent, order.id, 'abc').expect(400);
    expect(await prisma.kitchenDispatch.count()).toBe(0);
  });

  it('rendimiento: con 15 mesas y 60 envíos, consultas en menos de 200 ms y envíos en menos de 500 ms (p95)', async () => {
    const menuItem = await createMenuItem(prisma);
    const orders = [];
    for (let i = 0; i < 15; i++) orders.push((await createOpenOrder(prisma, juan.id)).order);
    for (let i = 0; i < 60; i++) {
      const order = orders[i % 15];
      if (!order) continue;
      await createSentItem(prisma, await createDispatch(prisma, order.id, juan.id), menuItem, { quantity: 2 });
    }
    const p95 = (samples: number[]): number => [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1] ?? 0;
    const time = async (run: () => Promise<unknown>): Promise<number> => {
      const start = performance.now();
      await run();
      return performance.now() - start;
    };
    const target = orders[0];
    if (!target) throw new Error('Sin pedidos de prueba');

    const tables: number[] = [];
    const reads: number[] = [];
    const sends: number[] = [];
    for (let i = 0; i < 20; i++) {
      tables.push(await time(() => juanAgent.get('/api/orders/tables').expect(200)));
      reads.push(await time(() => juanAgent.get(`/api/orders/${target.id}`).expect(200)));
      await createDraftItem(prisma, target.id, menuItem.id);
      sends.push(await time(() => send(juanAgent, target.id).expect(201)));
    }

    expect(p95(tables)).toBeLessThan(200);
    expect(p95(reads)).toBeLessThan(200);
    expect(p95(sends)).toBeLessThan(500);
  });
});
