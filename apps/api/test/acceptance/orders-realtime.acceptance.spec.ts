import type { NestExpressApplication } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import request from 'supertest';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { CSRF, createUser } from '../helpers/factories';
import { createTable } from '../helpers/order-factories';
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
});
