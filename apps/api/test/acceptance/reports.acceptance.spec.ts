import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { SalesReport, TopDish } from '@picanteria/shared';
import type { User } from '@prisma/client';
import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { createBillableOrder, markPaid, type BillableItemInput } from '../helpers/billing-factories';
import { resetDb } from '../helpers/db';
import { createUser, loginAs } from '../helpers/factories';
import { createMenuItem, createTable } from '../helpers/order-factories';

/** Hora de Lima (UTC−5, sin horario de verano). */
const lima = (local: string): Date => new Date(`${local}-05:00`);

describe('Feature 005 — reportes de ventas y platos más vendidos', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = prismaOf(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const user = (role: User['role']) => createUser(prisma, { role });
  /** Mozo y cajero de todas las cuentas de la prueba (crear usuarios es lento: hash Argon2). */
  let waiter: User;
  let cashier: User;

  beforeEach(async () => {
    await resetDb(prisma);
    waiter = await user('WAITER');
    cashier = await user('CASHIER');
  });
  const admin = async (): Promise<TestAgent> => loginAs(app, await user('ADMIN'));
  let tableNumber = 0;

  /** Cuenta pagada en `closedAt` (hora de Lima) con sus ítems y pagos. */
  async function paidAccount(input: {
    closedAt: string;
    items: BillableItemInput[];
    payments: Array<{ method: 'CASH' | 'YAPE_PLIN' | 'CARD'; amount: number; status?: 'VALID' | 'VOIDED' }>;
  }) {
    tableNumber += 1;
    const created = await createBillableOrder(prisma, { waiterId: waiter.id, tableNumber, items: input.items });
    await markPaid(prisma, { order: created.order, cashierId: cashier.id, closedAt: lima(input.closedAt), payments: input.payments });
    return created;
  }

  const sales = (agent: TestAgent, from: string, to: string) => agent.get(`/api/reports/sales?from=${from}&to=${to}`);
  const topDishes = (agent: TestAgent, query: string) => agent.get(`/api/reports/top-dishes?${query}`);

  /** Tres días de octubre: S/ 100.00 (efectivo), S/ 50.00 (Yape/Plin + tarjeta) y S/ 30.00 (tarjeta). */
  async function threeDays() {
    await paidAccount({ closedAt: '2026-10-10T13:00:00', items: [{ price: 100, quantity: 1 }], payments: [{ method: 'CASH', amount: 100 }] });
    await paidAccount({
      closedAt: '2026-10-11T20:00:00',
      items: [{ price: 50, quantity: 1 }],
      payments: [
        { method: 'YAPE_PLIN', amount: 20 },
        { method: 'CARD', amount: 30 },
      ],
    });
    await paidAccount({ closedAt: '2026-10-12T14:00:00', items: [{ price: 30, quantity: 1 }], payments: [{ method: 'CARD', amount: 30 }] });
  }

  it('[005] AC-4.1: total vendido, cantidad de cuentas y ticket promedio del rango', async () => {
    await threeDays();
    const report = (await sales(await admin(), '2026-10-01', '2026-10-31').expect(200)).body as SalesReport;

    expect(report).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
      total: { amount: 180, formatted: 'S/ 180.00' },
      accountsCount: 3,
      averageTicket: { amount: 60, formatted: 'S/ 60.00' },
    });
  });

  it('[005] AC-4.2: total por día en hora de Perú y por método, con los tres métodos siempre presentes', async () => {
    await threeDays();
    // 23:30 en Lima ya es el día siguiente en UTC: debe quedar el 12.
    await paidAccount({ closedAt: '2026-10-12T23:30:00', items: [{ price: 20, quantity: 1 }], payments: [{ method: 'CARD', amount: 20 }] });

    const report = (await sales(await admin(), '2026-10-10', '2026-10-12').expect(200)).body as SalesReport;

    expect(report.byDay).toEqual([
      { date: '2026-10-10', total: { amount: 100, formatted: 'S/ 100.00' }, accountsCount: 1 },
      { date: '2026-10-11', total: { amount: 50, formatted: 'S/ 50.00' }, accountsCount: 1 },
      { date: '2026-10-12', total: { amount: 50, formatted: 'S/ 50.00' }, accountsCount: 2 },
    ]);
    expect(report.byMethod).toEqual([
      { method: 'CASH', total: { amount: 100, formatted: 'S/ 100.00' } },
      { method: 'YAPE_PLIN', total: { amount: 20, formatted: 'S/ 20.00' } },
      { method: 'CARD', total: { amount: 80, formatted: 'S/ 80.00' } },
    ]);

    const onlyYape = (await sales(await admin(), '2026-10-11', '2026-10-11').expect(200)).body as SalesReport;
    expect(onlyYape.byMethod.map((line) => line.total.amount)).toEqual([0, 20, 30]);
  });

  it('[005] AC-4.3: los pagos anulados no suman y una cuenta cerrada sin cobro no cuenta', async () => {
    await paidAccount({
      closedAt: '2026-10-15T12:00:00',
      items: [{ price: 40, quantity: 1 }],
      payments: [
        { method: 'CASH', amount: 40, status: 'VOIDED' },
        { method: 'CARD', amount: 40 },
      ],
    });
    await paidAccount({ closedAt: '2026-10-15T13:00:00', items: [{ price: 25, quantity: 2, voidedQuantity: 2 }], payments: [] });

    const report = (await sales(await admin(), '2026-10-15', '2026-10-15').expect(200)).body as SalesReport;

    expect(report.total.formatted).toBe('S/ 40.00');
    expect(report.accountsCount).toBe(1);
    expect(report.byMethod.find((line) => line.method === 'CASH')?.total.amount).toBe(0);
  });

  it('[005] AC-4.4: un rango sin ventas responde ceros y sin días', async () => {
    await threeDays();
    const report = (await sales(await admin(), '2026-09-01', '2026-09-30').expect(200)).body as SalesReport;

    expect(report).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      total: { amount: 0, formatted: 'S/ 0.00' },
      accountsCount: 0,
      averageTicket: { amount: 0, formatted: 'S/ 0.00' },
      byDay: [],
      byMethod: [
        { method: 'CASH', total: { amount: 0, formatted: 'S/ 0.00' } },
        { method: 'YAPE_PLIN', total: { amount: 0, formatted: 'S/ 0.00' } },
        { method: 'CARD', total: { amount: 0, formatted: 'S/ 0.00' } },
      ],
    });
  });

  it('[005] AC-4.5: cajero, mozo y cocina no pueden ver los reportes', async () => {
    for (const role of ['CASHIER', 'WAITER', 'KITCHEN'] as const) {
      const agent = await loginAs(app, await user(role));
      const response = await sales(agent, '2026-10-01', '2026-10-31').expect(403);
      expect(response.body).toMatchObject({ code: 'FORBIDDEN', message: 'No tienes permiso para realizar esta acción' });
      await topDishes(agent, 'from=2026-10-01&to=2026-10-31').expect(403);
    }
  });

  it('rechaza un rango invertido o de más de 366 días, y fechas mal escritas', async () => {
    const agent = await admin();
    for (const [from, to] of [
      ['2026-10-31', '2026-10-01'],
      ['2026-01-01', '2027-01-02'],
    ]) {
      const response = await sales(agent, from ?? '', to ?? '').expect(400);
      expect(response.body).toMatchObject({ code: 'INVALID_DATE_RANGE', message: 'Elige un rango válido de hasta 366 días' });
    }
    await sales(agent, '2026-01-01', '2026-12-31').expect(200);
    await sales(agent, '2026-02-30', '2026-03-01').expect(400);
    await agent.get('/api/reports/sales?from=2026-10-01').expect(400);
  });

  describe('platos más vendidos', () => {
    /** Ají de Gallina: 5 unidades × S/ 20.00; Lomo Saltado: 2 × S/ 45.00; Chicha: 3 − 1 anulada × S/ 6.00. */
    async function ranking() {
      const aji = await createMenuItem(prisma, { name: 'Ají de Gallina', price: 20 });
      const lomo = await createMenuItem(prisma, { name: 'Lomo Saltado', price: 45 });
      const chicha = await createMenuItem(prisma, { name: 'Chicha Morada', price: 6 });
      await paidAccount({
        closedAt: '2026-10-05T13:00:00',
        items: [
          { menuItem: aji, price: 20, quantity: 3 },
          { menuItem: lomo, price: 45, quantity: 2 },
          { menuItem: chicha, price: 6, quantity: 3, voidedQuantity: 1 },
        ],
        payments: [{ method: 'CASH', amount: 162 }],
      });
      await paidAccount({ closedAt: '2026-10-06T13:00:00', items: [{ menuItem: aji, price: 20, quantity: 2 }], payments: [{ method: 'CARD', amount: 40 }] });
      return { aji, lomo, chicha };
    }

    it('[005] AC-5.1: ranking por unidades con puesto, unidades y monto', async () => {
      const { aji, lomo, chicha } = await ranking();
      const dishes = (await topDishes(await admin(), 'from=2026-10-01&to=2026-10-31').expect(200)).body as TopDish[];

      expect(dishes).toEqual([
        { rank: 1, menuItem: { id: aji.id, name: 'Ají de Gallina' }, units: 5, amount: { amount: 100, formatted: 'S/ 100.00' } },
        { rank: 2, menuItem: { id: chicha.id, name: 'Chicha Morada' }, units: 2, amount: { amount: 12, formatted: 'S/ 12.00' } },
        { rank: 3, menuItem: { id: lomo.id, name: 'Lomo Saltado' }, units: 2, amount: { amount: 90, formatted: 'S/ 90.00' } },
      ]);
    });

    it('[005] AC-5.2: ordenar por monto pone primero al plato caro que vende menos unidades', async () => {
      await ranking();
      const dishes = (await topDishes(await admin(), 'from=2026-10-01&to=2026-10-31&sortBy=amount').expect(200)).body as TopDish[];

      expect(dishes.map((dish) => [dish.rank, dish.menuItem.name])).toEqual([
        [1, 'Ají de Gallina'],
        [2, 'Lomo Saltado'],
        [3, 'Chicha Morada'],
      ]);
    });

    it('[005] AC-5.3: las unidades anuladas y las cuentas abiertas o canceladas no cuentan', async () => {
      const { lomo, chicha } = await ranking();
      // Cuenta abierta (por cobrar) y cuenta cancelada con el mismo lomo: no suman.
      await createBillableOrder(prisma, { waiterId: waiter.id, tableNumber: 90, items: [{ menuItem: lomo, price: 45, quantity: 10 }] });
      const cancelled = await createBillableOrder(prisma, { waiterId: waiter.id, tableNumber: 91, items: [{ menuItem: lomo, price: 45, quantity: 10 }] });
      await prisma.order.update({ where: { id: cancelled.order.id }, data: { status: 'CANCELLED', closedAt: lima('2026-10-07T12:00:00') } });

      const dishes = (await topDishes(await admin(), 'from=2026-10-01&to=2026-10-31').expect(200)).body as TopDish[];

      expect(dishes.find((dish) => dish.menuItem.id === lomo.id)?.units).toBe(2);
      expect(dishes.find((dish) => dish.menuItem.id === chicha.id)).toMatchObject({ units: 2, amount: { formatted: 'S/ 12.00' } });
    });

    it('[005] AC-5.4: cada unidad suma al precio con que se envió, no al precio actual', async () => {
      const ceviche = await createMenuItem(prisma, { name: 'Ceviche', price: 30 });
      await paidAccount({ closedAt: '2026-10-08T13:00:00', items: [{ menuItem: ceviche, price: 28, quantity: 2 }], payments: [{ method: 'CASH', amount: 56 }] });
      await paidAccount({ closedAt: '2026-10-09T13:00:00', items: [{ menuItem: ceviche, price: 30, quantity: 1 }], payments: [{ method: 'CASH', amount: 30 }] });

      const dishes = (await topDishes(await admin(), 'from=2026-10-01&to=2026-10-31').expect(200)).body as TopDish[];

      expect(dishes).toEqual([expect.objectContaining({ menuItem: { id: ceviche.id, name: 'Ceviche' }, units: 3, amount: { amount: 86, formatted: 'S/ 86.00' } })]);
    });
  });

  it('rendimiento (SC-007): un año con 5 000 cuentas pagadas responde en menos de 3 s', async () => {
    const table = await createTable(prisma, { tableNumber: 99 });
    const dishes = await Promise.all(Array.from({ length: 20 }, (_, index) => createMenuItem(prisma, { name: `Plato ${String(index)}`, price: 10 + index })));
    const year = Date.parse('2026-01-01T05:00:00Z');
    const orders = Array.from({ length: 5000 }, (_, index) => ({
      id: randomUUID(),
      tableId: table.id,
      waiterId: waiter.id,
      status: 'PAID' as const,
      closedAt: new Date(year + Math.floor((index / 5000) * 364 * 86_400_000)),
    }));
    const dispatches = orders.map((order, index) => ({
      id: randomUUID(),
      orderId: order.id,
      sequence: index + 1,
      round: 1,
      idempotencyKey: randomUUID(),
      sentById: waiter.id,
    }));
    const items = dispatches.flatMap((dispatch, index) =>
      [0, 1].map((offset) => {
        const dish = dishes[(index + offset * 7) % dishes.length];
        return {
          orderId: dispatch.orderId,
          dispatchId: dispatch.id,
          menuItemId: dish?.id ?? '',
          quantity: 2,
          unitPrice: dish?.price ?? 0,
          status: 'READY' as const,
        };
      }),
    );
    const payments = orders.map((order) => ({
      orderId: order.id,
      method: 'CARD' as const,
      amount: 50,
      idempotencyKey: randomUUID(),
      cashierId: cashier.id,
      paidAt: order.closedAt,
    }));
    await prisma.order.createMany({ data: orders });
    await prisma.kitchenDispatch.createMany({ data: dispatches });
    await prisma.orderItem.createMany({ data: items });
    await prisma.payment.createMany({ data: payments });
    // Estadísticas al día, como las mantiene autovacuum en uso normal; sin esto el planificador
    // cree que las tablas siguen vacías tras la carga masiva.
    await prisma.$executeRaw`ANALYZE orders, payments, order_items, menu_items`;
    const agent = await admin();

    let started = Date.now();
    const report = (await sales(agent, '2026-01-01', '2026-12-31').expect(200)).body as SalesReport;
    expect(Date.now() - started).toBeLessThan(3000);
    expect(report.accountsCount).toBe(5000);

    started = Date.now();
    await topDishes(agent, 'from=2026-01-01&to=2026-12-31&sortBy=amount').expect(200);
    expect(Date.now() - started).toBeLessThan(3000);
  }, 60_000);
});
