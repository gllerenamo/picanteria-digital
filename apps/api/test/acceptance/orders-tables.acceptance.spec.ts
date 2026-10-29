import type { NestExpressApplication } from '@nestjs/platform-express';
import type { OrderDetail, TableOverview } from '@picanteria/shared';
import type { User } from '@prisma/client';
import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { createUser, loginAs } from '../helpers/factories';
import { createDispatch, createOpenOrder, createTable } from '../helpers/order-factories';

describe('Feature 003 — US1: ver las mesas y abrir una mesa libre', () => {
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

  const openOrders = (tableId: string) => prisma.order.count({ where: { tableId, status: 'OPEN' } });

  it('[003] AC-1.1: el mozo ve todas las mesas con su número, su estado y el responsable de las ocupadas', async () => {
    await createTable(prisma, { tableNumber: 2 });
    await createOpenOrder(prisma, rosa.id, { tableNumber: 1 });
    await createOpenOrder(prisma, rosa.id, { tableNumber: 3, tableStatus: 'POR_COBRAR' });

    const body: unknown = (await juanAgent.get('/api/orders/tables').expect(200)).body;
    const tables = body as TableOverview[];

    expect(tables.map((t) => [t.tableNumber, t.status])).toEqual([
      [1, 'OCUPADA'],
      [2, 'LIBRE'],
      [3, 'POR_COBRAR'],
    ]);
    expect(tables[0]?.order?.waiter.fullName).toBe('Rosa Quispe');
    expect(tables[1]?.order).toBeNull();
  });

  it('[003] AC-1.2: abrir una mesa libre la ocupa y registra al mozo y la hora de apertura', async () => {
    const table = await createTable(prisma, { tableNumber: 5 });

    const body: unknown = (await juanAgent.post('/api/orders').send({ tableId: table.id }).expect(201)).body;
    const order = body as OrderDetail;

    expect(order).toMatchObject({ status: 'OPEN', waiter: { id: juan.id }, table: { tableNumber: 5, status: 'OCUPADA' } });
    expect(Date.parse(order.openedAt)).not.toBeNaN();
    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id: table.id } })).status).toBe('OCUPADA');
  });

  it('[003] AC-1.4: una mesa ocupada o por cobrar no se vuelve a abrir', async () => {
    const { table: busy } = await createOpenOrder(prisma, rosa.id);
    const { table: billing } = await createOpenOrder(prisma, rosa.id, { tableStatus: 'POR_COBRAR' });

    for (const table of [busy, billing]) {
      const body: unknown = (await juanAgent.post('/api/orders').send({ tableId: table.id }).expect(409)).body;
      expect(body).toMatchObject({ code: 'TABLE_NOT_AVAILABLE', message: 'La mesa ya la abrió Rosa Quispe' });
      expect(await openOrders(table.id)).toBe(1);
    }
  });

  it('[003] AC-1.5: si dos mozos abren la misma mesa a la vez, solo uno lo logra (SC-008)', async () => {
    const table = await createTable(prisma);

    const [first, second] = await Promise.all([
      juanAgent.post('/api/orders').send({ tableId: table.id }),
      rosaAgent.post('/api/orders').send({ tableId: table.id }),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const loser = first.status === 409 ? first : second;
    const winner = first.status === 201 ? juan : rosa;
    expect(loser.body).toMatchObject({
      code: 'TABLE_NOT_AVAILABLE',
      message: `La mesa ya la abrió ${winner.fullName}`,
      details: { status: 'OCUPADA', openedBy: { fullName: winner.fullName } },
    });
    expect(await openOrders(table.id)).toBe(1);
  });

  it('[003] AC-1.6: el responsable cancela una apertura sin nada enviado y la mesa vuelve a libre', async () => {
    const { table, order } = await createOpenOrder(prisma, juan.id);

    await juanAgent.post(`/api/orders/${order.id}/cancel`).expect(204);

    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('CANCELLED');
    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id: table.id } })).status).toBe('LIBRE');

    const { order: sent } = await createOpenOrder(prisma, juan.id);
    await createDispatch(prisma, sent.id, juan.id);
    const body: unknown = (await juanAgent.post(`/api/orders/${sent.id}/cancel`).expect(409)).body;
    expect(body).toMatchObject({ code: 'CANCEL_NOT_ALLOWED' });
  });

  it('[003] AC-1.7: los comensales son opcionales al abrir y cualquier mozo los registra después', async () => {
    const table = await createTable(prisma);
    const body: unknown = (await juanAgent.post('/api/orders').send({ tableId: table.id }).expect(201)).body;
    const order = body as OrderDetail;
    expect(order.guestCount).toBeNull();

    const updated = await rosaAgent.patch(`/api/orders/${order.id}`).send({ guestCount: 4 }).expect(200);
    expect((updated.body as OrderDetail).guestCount).toBe(4);
    await rosaAgent.patch(`/api/orders/${order.id}`).send({ guestCount: 0 }).expect(400);
  });

  it('[003] AC-1.8: otro mozo no puede cancelar la apertura; un administrador sí', async () => {
    const { order } = await createOpenOrder(prisma, juan.id);

    const body: unknown = (await rosaAgent.post(`/api/orders/${order.id}/cancel`).expect(403)).body;
    expect(body).toEqual({ code: 'FORBIDDEN', message: 'Solo el mozo que abrió la mesa puede cancelar la apertura' });

    const admin = await createUser(prisma, { role: 'ADMIN' });
    await (await loginAs(app, admin)).post(`/api/orders/${order.id}/cancel`).expect(204);
  });

  it('cocina no ve el tablero de mesas; caja sí', async () => {
    const kitchen = await createUser(prisma, { role: 'KITCHEN' });
    const cashier = await createUser(prisma, { role: 'CASHIER' });
    await (await loginAs(app, kitchen)).get('/api/orders/tables').expect(403);
    await (await loginAs(app, cashier)).get('/api/orders/tables').expect(200);
  });
});
