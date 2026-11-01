import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AccountDetail, ClosureSummary, DayClosure } from '@picanteria/shared';
import type { User } from '@prisma/client';
import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { createBillableOrder, pay } from '../helpers/billing-factories';
import { resetDb } from '../helpers/db';
import { createUser, loginAs } from '../helpers/factories';

describe('Feature 005 — cierre del día', () => {
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
  let tableNumber = 0;
  /** Mozo de todas las cuentas de la prueba (crear usuarios es lento: hash Argon2). */
  let waiter: User;

  beforeEach(async () => {
    await resetDb(prisma);
    waiter = await user('WAITER');
  });

  /** Cobra una cuenta nueva con los pagos indicados (la mesa queda libre). */
  async function chargedAccount(cashier: TestAgent, payments: Array<{ method: 'CASH' | 'YAPE_PLIN' | 'CARD'; amount: number }>) {
    const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
    tableNumber += 1;
    const { order } = await createBillableOrder(prisma, { waiterId: waiter.id, tableNumber, items: [{ price: total, quantity: 1 }] });
    let account: AccountDetail | undefined;
    for (const payment of payments) {
      const body =
        payment.method === 'CASH'
          ? { method: payment.method, amount: payment.amount, receivedAmount: payment.amount }
          : { method: payment.method, amount: payment.amount };
      account = (await pay(cashier, order.id, body).expect(201)).body as AccountDetail;
    }
    return { order, account };
  }

  const counts = { countedCash: 50, countedYapePlin: 30, countedCard: 20 };

  /** Cobros con los tres métodos: efectivo S/ 50.00, Yape/Plin S/ 30.00, tarjeta S/ 20.00, y un pago anulado. */
  async function dayOfSales(cashier: TestAgent) {
    await chargedAccount(cashier, [{ method: 'CASH', amount: 50 }]);
    await chargedAccount(cashier, [
      { method: 'YAPE_PLIN', amount: 30 },
      { method: 'CARD', amount: 20 },
    ]);
    // Una cuenta con un pago anulado y luego cobrada con otro: el anulado no cuenta.
    tableNumber += 1;
    const { order } = await createBillableOrder(prisma, { waiterId: waiter.id, tableNumber, items: [{ price: 15, quantity: 1 }] });
    const wrong = (await pay(cashier, order.id, { method: 'CARD', amount: 15 - 5 }).expect(201)).body as AccountDetail;
    await cashier
      .post(`/api/billing/accounts/${order.id}/payments/${wrong.payments[0]?.id ?? ''}/void`)
      .send({ reason: 'Monto equivocado' })
      .expect(200);
    await pay(cashier, order.id, { method: 'CASH', amount: 15, receivedAmount: 20 }).expect(201);
  }

  it('[005] AC-3.1: el resumen exige los montos contados antes de mostrar lo registrado', async () => {
    const cashier = await loginAs(app, await user('CASHIER'));
    await dayOfSales(cashier);

    const blind = await cashier.post('/api/billing/closures/preview').send({}).expect(400);
    expect(blind.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(JSON.stringify(blind.body)).not.toContain('65');

    const response = await cashier.post('/api/billing/closures/preview').send(counts).expect(200);
    expect((response.body as ClosureSummary).lines.map((line) => line.expected.formatted)).toEqual(['S/ 65.00', 'S/ 30.00', 'S/ 20.00']);
    expect(await prisma.dayClosure.count()).toBe(0);
  });

  it('[005] AC-3.2: muestra por método lo registrado (sin anulados), lo contado y la diferencia, el total y las cuentas', async () => {
    const cashier = await loginAs(app, await user('CASHIER'));
    await dayOfSales(cashier);

    const response = await cashier.post('/api/billing/closures/preview').send({ countedCash: 60, countedYapePlin: 30, countedCard: 21.5 }).expect(200);
    const summary = response.body as ClosureSummary;

    expect(summary.lines).toEqual([
      { method: 'CASH', expected: { amount: 65, formatted: 'S/ 65.00' }, counted: { amount: 60, formatted: 'S/ 60.00' }, difference: { amount: -5, formatted: 'S/ -5.00' } },
      { method: 'YAPE_PLIN', expected: { amount: 30, formatted: 'S/ 30.00' }, counted: { amount: 30, formatted: 'S/ 30.00' }, difference: { amount: 0, formatted: 'S/ 0.00' } },
      { method: 'CARD', expected: { amount: 20, formatted: 'S/ 20.00' }, counted: { amount: 21.5, formatted: 'S/ 21.50' }, difference: { amount: 1.5, formatted: 'S/ 1.50' } },
    ]);
    expect(summary.total.formatted).toBe('S/ 115.00');
    expect(summary.accountsCount).toBe(3);
    expect(summary.hasDifferences).toBe(true);
    expect(summary.startedAt).not.toBeNull();
  });

  it('[005] AC-3.3: con diferencias exige la observación; con ella guarda el cierre', async () => {
    const cashier = await loginAs(app, await user('CASHIER'));
    await dayOfSales(cashier);
    const withDifference = { countedCash: 60, countedYapePlin: 30, countedCard: 20 };

    const refused = await cashier.post('/api/billing/closures').send(withDifference).expect(409);
    expect(refused.body).toMatchObject({ code: 'CLOSURE_NOTES_REQUIRED', message: 'Explica las diferencias en la observación antes de cerrar' });
    expect(await prisma.dayClosure.count()).toBe(0);

    const response = await cashier.post('/api/billing/closures').send({ ...withDifference, notes: 'Faltan S/ 5.00 de un vuelto mal dado' }).expect(201);
    const closure = response.body as DayClosure;
    expect(closure).toMatchObject({ notes: 'Faltan S/ 5.00 de un vuelto mal dado', hasDifferences: true, accountsCount: 3 });
    expect(await prisma.payment.count({ where: { closureId: null } })).toBe(0);
  });

  it('[005] AC-3.4: un cobro posterior al cierre no lo cambia y pertenece a la siguiente jornada', async () => {
    const cashier = await loginAs(app, await user('CASHIER'));
    await chargedAccount(cashier, [{ method: 'CASH', amount: 50 }]);
    const first = (await cashier.post('/api/billing/closures').send({ countedCash: 50, countedYapePlin: 0, countedCard: 0 }).expect(201)).body as DayClosure;

    await chargedAccount(cashier, [{ method: 'YAPE_PLIN', amount: 25 }]);

    const history = (await cashier.get('/api/billing/closures').expect(200)).body as DayClosure[];
    expect(history).toEqual([expect.objectContaining({ id: first.id, total: { amount: 50, formatted: 'S/ 50.00' }, accountsCount: 1 })]);
    const next = (await cashier.post('/api/billing/closures/preview').send({ countedCash: 0, countedYapePlin: 25, countedCard: 0 }).expect(200)).body as ClosureSummary;
    expect(next.lines.map((line) => line.expected.amount)).toEqual([0, 25, 0]);
    expect(next.startedAt).toBe(first.closedAt);
    expect(next.hasDifferences).toBe(false);
  });

  it('[005] AC-3.5: con mesas ocupadas o por cobrar no se puede cerrar e indica cuáles', async () => {
    await createBillableOrder(prisma, { waiterId: waiter.id, tableNumber: 7, tableStatus: 'OCUPADA', items: [{ price: 10, quantity: 1 }] });
    await createBillableOrder(prisma, { waiterId: waiter.id, tableNumber: 3, items: [{ price: 10, quantity: 1 }] });
    const cashier = await loginAs(app, await user('CASHIER'));

    for (const path of ['/api/billing/closures/preview', '/api/billing/closures']) {
      const response = await cashier.post(path).send({ countedCash: 0, countedYapePlin: 0, countedCard: 0 }).expect(409);
      expect(response.body).toMatchObject({ code: 'CLOSURE_OPEN_TABLES', message: 'No puedes cerrar con mesas abiertas', details: { tables: [3, 7] } });
    }
    expect(await prisma.dayClosure.count()).toBe(0);
  });

  it('[005] AC-3.6: el cajero y el administrador ven el historial, el más reciente primero', async () => {
    const cashierUser = await user('CASHIER');
    const cashierName = cashierUser.fullName;
    const cashier = await loginAs(app, cashierUser);
    await chargedAccount(cashier, [{ method: 'CARD', amount: 12 }]);
    await cashier.post('/api/billing/closures').send({ countedCash: 0, countedYapePlin: 0, countedCard: 12 }).expect(201);
    await chargedAccount(cashier, [{ method: 'CASH', amount: 8 }]);
    await cashier.post('/api/billing/closures').send({ countedCash: 7, countedYapePlin: 0, countedCard: 0, notes: 'Falta un sol' }).expect(201);

    for (const agent of [cashier, await loginAs(app, await user('ADMIN'))]) {
      const history = (await agent.get('/api/billing/closures').expect(200)).body as DayClosure[];
      expect(history.map((closure) => closure.total.formatted)).toEqual(['S/ 8.00', 'S/ 12.00']);
      expect(history[0]).toMatchObject({ notes: 'Falta un sol', cashier: { fullName: cashierName } });
      expect(history[0]?.lines[0]).toMatchObject({ method: 'CASH', counted: { amount: 7, formatted: 'S/ 7.00' }, difference: { amount: -1, formatted: 'S/ -1.00' } });
    }
    await (await loginAs(app, await user('WAITER'))).get('/api/billing/closures').expect(403);
  });

  it('dos cierres a la vez: los pagos quedan en un solo cierre', async () => {
    const cashier = await loginAs(app, await user('CASHIER'));
    await chargedAccount(cashier, [{ method: 'CASH', amount: 40 }]);
    const body = { countedCash: 40, countedYapePlin: 0, countedCard: 0, notes: 'Cierre simultáneo' };

    const responses = await Promise.all([cashier.post('/api/billing/closures').send(body), cashier.post('/api/billing/closures').send(body)]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    const closures = await prisma.dayClosure.findMany({ include: { payments: true } });
    expect(closures.filter((closure) => closure.payments.length > 0)).toHaveLength(1);
    expect(closures.map((closure) => Number(closure.total)).sort((a, b) => a - b)).toEqual([0, 40]);
  });

  it('un cierre sin cobros se permite con todo en cero', async () => {
    const cashier = await loginAs(app, await user('CASHIER'));
    const response = await cashier.post('/api/billing/closures').send({ countedCash: 0, countedYapePlin: 0, countedCard: 0 }).expect(201);
    expect(response.body).toMatchObject({ total: { formatted: 'S/ 0.00' }, accountsCount: 0, startedAt: null, hasDifferences: false });
  });
});
