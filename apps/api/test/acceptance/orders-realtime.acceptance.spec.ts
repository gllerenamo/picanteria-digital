import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import request from 'supertest';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { CSRF, createUser } from '../helpers/factories';
import {
  createDispatch,
  createDraftItem,
  createMenuItem,
  createOpenOrder,
  createSentItem,
  createTable,
  simulateCashierPayment,
} from '../helpers/order-factories';
import { connectAs, expectNoEvent, listen, nextEvent, sessionCookie, type TestSocket } from '../helpers/realtime';

describe('Feature 003 — eventos de tiempo real de mesas y pedidos', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let url: string;
  const sockets: TestSocket[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = prismaOf(app);
    url = await listen(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  const user = (role: User['role']) => createUser(prisma, { role });

  /** Cliente HTTP con la sesión del usuario (cookie y cabecera CSRF). */
  const asUser = async (someone: User & { password: string }) =>
    request.agent(url).set(CSRF).set('Cookie', await sessionCookie(url, someone));

  it('[003] AC-1.3: al abrir una mesa, los demás mozos y caja lo saben sin recargar; cocina no', async () => {
    const juan = await user('WAITER');
    const rosaSocket = await connectAs(url, await user('WAITER'), sockets);
    const cashierSocket = await connectAs(url, await user('CASHIER'), sockets);
    const kitchenSocket = await connectAs(url, await user('KITCHEN'), sockets);
    const table = await createTable(prisma, { tableNumber: 7 });
    const rosaEvent = nextEvent(rosaSocket, 'orders:table-status-changed');
    const cashierEvent = nextEvent(cashierSocket, 'orders:table-status-changed');
    const kitchenSilent = expectNoEvent(kitchenSocket, 'orders:table-status-changed');

    const response = await request(url)
      .post('/api/orders')
      .set(CSRF)
      .set('Cookie', await sessionCookie(url, juan))
      .send({ tableId: table.id })
      .expect(201);

    const expected = { tableId: table.id, tableNumber: 7, status: 'OCUPADA', orderId: (response.body as { id: string }).id };
    await expect(rosaEvent).resolves.toMatchObject(expected);
    await expect(cashierEvent).resolves.toMatchObject(expected);
    await kitchenSilent;
  });

  it('[003] AC-3.2: la cocina recibe el envío en menos de 3 s sin recargar; el reintento no se repite (SC-003)', async () => {
    const juan = await user('WAITER');
    const kitchenSocket = await connectAs(url, await user('KITCHEN'), sockets);
    const { order, table } = await createOpenOrder(prisma, juan.id);
    const menuItem = await createMenuItem(prisma);
    await createDraftItem(prisma, order.id, menuItem.id);
    await createDraftItem(prisma, order.id, menuItem.id, { notes: 'sin ají' });
    const received = nextEvent(kitchenSocket, 'orders:dispatch-sent');
    const juanAgent = await asUser(juan);
    const key = randomUUID();

    const response = await juanAgent.post(`/api/orders/${order.id}/dispatches`).set('Idempotency-Key', key).expect(201);

    await expect(received).resolves.toMatchObject({
      dispatchId: (response.body as { id: string }).id,
      sequence: 1,
      round: 1,
      orderId: order.id,
      tableNumber: table.tableNumber,
      itemCount: 2,
    });
    const silent = expectNoEvent(kitchenSocket, 'orders:dispatch-sent');
    await juanAgent.post(`/api/orders/${order.id}/dispatches`).set('Idempotency-Key', key).expect(201);
    await silent;
  });

  it('[003] AC-5.2: la cocina se entera de la anulación sin recargar', async () => {
    const waiter = await user('WAITER');
    const kitchenSocket = await connectAs(url, await user('KITCHEN'), sockets);
    const { order, table } = await createOpenOrder(prisma, waiter.id);
    const dispatch = await createDispatch(prisma, order.id, waiter.id);
    const item = await createSentItem(prisma, dispatch, await createMenuItem(prisma), { quantity: 3 });
    const received = nextEvent(kitchenSocket, 'orders:item-voided');

    const adminAgent = await asUser(await user('ADMIN'));
    await adminAgent.post(`/api/order-items/${item.id}/voids`).send({ units: 1, reason: 'Solo quieren dos' }).expect(201);

    await expect(received).resolves.toMatchObject({
      orderItemId: item.id,
      dispatchId: dispatch.id,
      tableNumber: table.tableNumber,
      units: 1,
      remainingQuantity: 2,
    });
  });

  it('[003] AC-6.1: los mozos y caja ven la mesa por cobrar sin recargar (SC-004)', async () => {
    const juan = await user('WAITER');
    const rosaSocket = await connectAs(url, await user('WAITER'), sockets);
    const cashierSocket = await connectAs(url, await user('CASHIER'), sockets);
    const { order, table } = await createOpenOrder(prisma, juan.id);
    await createSentItem(prisma, await createDispatch(prisma, order.id, juan.id), await createMenuItem(prisma));
    const rosaEvent = nextEvent(rosaSocket, 'orders:table-status-changed');
    const cashierEvent = nextEvent(cashierSocket, 'orders:table-status-changed');

    await (await asUser(juan)).post(`/api/orders/${order.id}/request-bill`).expect(200);

    const expected = { tableId: table.id, status: 'POR_COBRAR', orderId: order.id };
    await expect(rosaEvent).resolves.toMatchObject(expected);
    await expect(cashierEvent).resolves.toMatchObject(expected);
  });

  it('[003] AC-6.6 (tiempo real): cuando Caja cobra, los mozos ven la mesa libre sin recargar', async () => {
    const juan = await user('WAITER');
    const rosaSocket = await connectAs(url, await user('WAITER'), sockets);
    const { order, table } = await createOpenOrder(prisma, juan.id, { tableStatus: 'POR_COBRAR' });
    await createSentItem(prisma, await createDispatch(prisma, order.id, juan.id), await createMenuItem(prisma));
    const received = nextEvent(rosaSocket, 'orders:table-status-changed');

    // Lo que hará Caja (005) al cobrar; su prueba de cobro reemplazará a este sustituto.
    await simulateCashierPayment(app, prisma, order.id);

    await expect(received).resolves.toMatchObject({ tableId: table.id, status: 'LIBRE', orderId: order.id });
  });
});
