import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AccountSummary } from '@picanteria/shared';
import type { User } from '@prisma/client';
import request from 'supertest';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { createBillableOrder, pay } from '../helpers/billing-factories';
import { resetDb } from '../helpers/db';
import { CSRF, createUser } from '../helpers/factories';
import { createMenuItem } from '../helpers/order-factories';
import { connectAs, listen, nextEvent, sessionCookie, type TestSocket } from '../helpers/realtime';

describe('Feature 005 — caja en tiempo real con el flujo de la 003', () => {
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
  const asUser = async (someone: User & { password: string }) =>
    request.agent(url).set(CSRF).set('Cookie', await sessionCookie(url, someone));

  it('[005] AC-1.1: cuando el mozo pide la cuenta, la caja recibe la mesa por cobrar y la lista con su total', async () => {
    const waiter = await user('WAITER');
    const cashier = await user('CASHIER');
    const cashierSocket = await connectAs(url, cashier, sockets);
    const { order, table } = await createBillableOrder(prisma, {
      waiterId: waiter.id,
      tableNumber: 4,
      tableStatus: 'OCUPADA',
      items: [{ price: 24.5, quantity: 2 }],
    });
    const received = nextEvent(cashierSocket, 'orders:table-status-changed');

    await (await asUser(waiter)).post(`/api/orders/${order.id}/request-bill`).expect(200);

    await expect(received).resolves.toMatchObject({ tableId: table.id, tableNumber: 4, status: 'POR_COBRAR', orderId: order.id });
    const list = (await (await asUser(cashier)).get('/api/billing/accounts').expect(200)).body as AccountSummary[];
    expect(list).toEqual([
      expect.objectContaining({
        orderId: order.id,
        tableNumber: 4,
        waiter: { id: waiter.id, fullName: waiter.fullName },
        total: { amount: 49, formatted: 'S/ 49.00' },
        pending: { amount: 49, formatted: 'S/ 49.00' },
      }),
    ]);
  });

  it('[005] AC-1.7: si el mozo agrega algo a la mesa por cobrar, la caja la ve ocupada y no puede cobrar', async () => {
    const waiter = await user('WAITER');
    const cashier = await user('CASHIER');
    const cashierSocket = await connectAs(url, cashier, sockets);
    const { order } = await createBillableOrder(prisma, { waiterId: waiter.id, items: [{ price: 20, quantity: 1 }] });
    const extra = await createMenuItem(prisma, { price: 6.5 });
    const received = nextEvent(cashierSocket, 'orders:table-status-changed');

    await (await asUser(waiter))
      .post(`/api/orders/${order.id}/items`)
      .send({ menuItemId: extra.id, quantity: 1, confirmReopen: true })
      .expect(201);

    await expect(received).resolves.toMatchObject({ status: 'OCUPADA', orderId: order.id });
    const cashierHttp = await asUser(cashier);
    const detail = await cashierHttp.get(`/api/billing/accounts/${order.id}`).expect(200);
    expect(detail.body).toMatchObject({ table: { status: 'OCUPADA' }, canCharge: false });
    const refused = await pay(cashierHttp, order.id, { method: 'CARD', amount: 20 }).expect(409);
    expect(refused.body).toMatchObject({ code: 'BILL_NOT_REQUESTED' });
  });

  it('al completar el pago, los mozos ven la mesa libre y los cajeros la cuenta pagada', async () => {
    const waiter = await user('WAITER');
    const cashier = await user('CASHIER');
    const waiterSocket = await connectAs(url, waiter, sockets);
    const otherCashierSocket = await connectAs(url, await user('CASHIER'), sockets);
    const { order, table } = await createBillableOrder(prisma, { waiterId: waiter.id, tableNumber: 6, items: [{ price: 35, quantity: 1 }] });
    const freed = nextEvent(waiterSocket, 'orders:table-status-changed');
    const updated = nextEvent(otherCashierSocket, 'billing:account-updated');

    await pay(await asUser(cashier), order.id, { method: 'YAPE_PLIN', amount: 35 }).expect(201);

    await expect(freed).resolves.toMatchObject({ tableId: table.id, tableNumber: 6, status: 'LIBRE', orderId: order.id });
    await expect(updated).resolves.toMatchObject({
      orderId: order.id,
      tableNumber: 6,
      reason: 'PAID',
      pending: { amount: 0, formatted: 'S/ 0.00' },
    });
  });
});
