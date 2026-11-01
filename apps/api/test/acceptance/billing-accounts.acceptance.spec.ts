import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AccountDetail, AccountSummary } from '@picanteria/shared';
import type { User } from '@prisma/client';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { createBillableOrder, pay } from '../helpers/billing-factories';
import { resetDb } from '../helpers/db';
import { createUser, loginAs } from '../helpers/factories';

describe('Feature 005 — cobrar la cuenta completa de una mesa', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = prismaOf(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  const user = (role: User['role']) => createUser(prisma, { role });
  const cashierAgent = async () => loginAs(app, await user('CASHIER'));

  /** Mesa 5 por cobrar: Rocoto Relleno 3 × S/ 28.00 (1 anulada) y Chicha 2 × S/ 6.50 anulada del todo. */
  async function mixedAccount(tableNumber = 5) {
    const waiter = await user('WAITER');
    return createBillableOrder(prisma, {
      waiterId: waiter.id,
      tableNumber,
      items: [
        { name: 'Rocoto Relleno', price: 28, quantity: 3, voidedQuantity: 1 },
        { name: 'Chicha Morada', price: 6.5, quantity: 2, voidedQuantity: 2 },
      ],
    });
  }

  it('[005] AC-1.2: la cuenta muestra unidades vigentes, anuladas, precio y subtotal; el total excluye lo anulado', async () => {
    const { order } = await mixedAccount();
    const cashier = await cashierAgent();

    const response = await cashier.get(`/api/billing/accounts/${order.id}`).expect(200);
    const account = response.body as AccountDetail;

    expect(account.table).toMatchObject({ tableNumber: 5, status: 'POR_COBRAR' });
    expect(account.items).toMatchObject([
      {
        menuItem: { name: 'Rocoto Relleno' },
        quantity: 3,
        voidedQuantity: 1,
        activeQuantity: 2,
        unitPrice: { amount: 28, formatted: 'S/ 28.00' },
        subtotal: { amount: 56, formatted: 'S/ 56.00' },
      },
      {
        menuItem: { name: 'Chicha Morada' },
        voidedQuantity: 2,
        activeQuantity: 0,
        subtotal: { amount: 0, formatted: 'S/ 0.00' },
      },
    ]);
    expect(account.total.formatted).toBe('S/ 56.00');
    expect(account.pending.formatted).toBe('S/ 56.00');
    expect(account.canCharge).toBe(true);
  });

  it('[005] AC-1.3: un pago en efectivo por el total da el vuelto, deja la cuenta pagada y la mesa libre', async () => {
    const { order, table } = await mixedAccount();
    const cashier = await cashierAgent();

    const response = await pay(cashier, order.id, { method: 'CASH', amount: 56, receivedAmount: 60 }).expect(201);
    const account = response.body as AccountDetail;

    expect(account.orderStatus).toBe('PAID');
    expect(account.pending.formatted).toBe('S/ 0.00');
    expect(account.payments).toEqual([
      expect.objectContaining({
        method: 'CASH',
        amount: { amount: 56, formatted: 'S/ 56.00' },
        receivedAmount: { amount: 60, formatted: 'S/ 60.00' },
        changeAmount: { amount: 4, formatted: 'S/ 4.00' },
        status: 'VALID',
      }),
    ]);
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.status).toBe('PAID');
    expect(saved.closedAt).not.toBeNull();
    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id: table.id } })).status).toBe('LIBRE');
  });

  it('[005] AC-1.4: Yape/Plin y tarjeta pagan el total con su referencia y liberan la mesa', async () => {
    const cashier = await cashierAgent();
    for (const [method, tableNumber] of [
      ['YAPE_PLIN', 5],
      ['CARD', 6],
    ] as const) {
      const { order, table } = await mixedAccount(tableNumber);
      const response = await pay(cashier, order.id, { method, amount: 56, reference: 'OP-123456' }).expect(201);
      const account = response.body as AccountDetail;

      expect(account.orderStatus).toBe('PAID');
      expect(account.payments[0]).toMatchObject({ method, reference: 'OP-123456', receivedAmount: null, changeAmount: null });
      expect((await prisma.diningTable.findUniqueOrThrow({ where: { id: table.id } })).status).toBe('LIBRE');
    }
  });

  it('[005] AC-1.5: en efectivo, un monto recibido menor no registra el pago', async () => {
    const { order } = await mixedAccount();
    const cashier = await cashierAgent();

    const response = await pay(cashier, order.id, { method: 'CASH', amount: 56, receivedAmount: 50 }).expect(409);

    expect(response.body).toMatchObject({ code: 'INSUFFICIENT_CASH', message: 'El monto recibido no alcanza para cubrir el pago' });
    expect(await prisma.payment.count()).toBe(0);
  });

  it('[005] AC-1.6: con la mesa ocupada (sin cuenta pedida) no se puede cobrar', async () => {
    const waiter = await user('WAITER');
    const { order } = await createBillableOrder(prisma, {
      waiterId: waiter.id,
      tableStatus: 'OCUPADA',
      items: [{ price: 20, quantity: 1 }],
    });
    const cashier = await cashierAgent();

    const response = await pay(cashier, order.id, { method: 'CARD', amount: 20 }).expect(409);

    expect(response.body).toMatchObject({ code: 'BILL_NOT_REQUESTED', message: 'El mozo debe pedir la cuenta antes de cobrar' });
    expect(await prisma.payment.count()).toBe(0);
  });

  it('[005] AC-1.8: mozo y cocina no pueden ver las cuentas ni registrar pagos', async () => {
    const { order } = await mixedAccount();
    for (const role of ['WAITER', 'KITCHEN'] as const) {
      const agent = await loginAs(app, await user(role));
      const list = await agent.get('/api/billing/accounts').expect(403);
      expect(list.body).toMatchObject({ code: 'FORBIDDEN' });
      await agent.get(`/api/billing/accounts/${order.id}`).expect(403);
      await pay(agent, order.id, { method: 'CARD', amount: 56 }).expect(403);
    }
    expect(await prisma.payment.count()).toBe(0);
  });

  it('lista las mesas por cobrar por número de mesa con mozo, total y saldo; no las ocupadas', async () => {
    const waiter = await user('WAITER');
    await createBillableOrder(prisma, { waiterId: waiter.id, tableNumber: 7, items: [{ price: 10, quantity: 2 }] });
    await createBillableOrder(prisma, { waiterId: waiter.id, tableNumber: 3, items: [{ price: 15.5, quantity: 1 }] });
    await createBillableOrder(prisma, { waiterId: waiter.id, tableNumber: 4, tableStatus: 'OCUPADA', items: [{ price: 9, quantity: 1 }] });
    const cashier = await cashierAgent();

    const response = await cashier.get('/api/billing/accounts').expect(200);
    const list = response.body as AccountSummary[];

    expect(list.map((account) => account.tableNumber)).toEqual([3, 7]);
    expect(list[0]).toMatchObject({
      waiter: { id: waiter.id, fullName: waiter.fullName },
      total: { formatted: 'S/ 15.50' },
      pending: { formatted: 'S/ 15.50' },
    });
  });

  it('reintentar con la misma Idempotency-Key devuelve el mismo resultado sin duplicar el pago', async () => {
    const { order } = await mixedAccount();
    const cashier = await cashierAgent();
    const key = randomUUID();

    const first = await pay(cashier, order.id, { method: 'CASH', amount: 56, receivedAmount: 100 }, key).expect(201);
    const retry = await pay(cashier, order.id, { method: 'CASH', amount: 56, receivedAmount: 100 }, key).expect(201);

    expect(retry.body).toEqual(first.body);
    expect(await prisma.payment.count()).toBe(1);

    const reused = await pay(cashier, order.id, { method: 'CARD', amount: 56 }, key).expect(409);
    expect(reused.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('no acepta un pago mayor que el saldo ni cobrar una cuenta ya pagada (FR-007, FR-010)', async () => {
    const { order } = await mixedAccount();
    const cashier = await cashierAgent();

    const exceeds = await pay(cashier, order.id, { method: 'CARD', amount: 60 }).expect(409);
    expect(exceeds.body).toMatchObject({ code: 'PAYMENT_EXCEEDS_BALANCE', details: { pending: 'S/ 56.00' } });

    await pay(cashier, order.id, { method: 'CARD', amount: 56 }).expect(201);
    const again = await pay(cashier, order.id, { method: 'CARD', amount: 1 }).expect(409);
    expect(again.body).toMatchObject({ code: 'ORDER_NOT_OPEN' });
  });

  it('valida el cuerpo: efectivo sin monto recibido, referencia en efectivo y sin Idempotency-Key', async () => {
    const { order } = await mixedAccount();
    const cashier = await cashierAgent();

    const noReceived = await pay(cashier, order.id, { method: 'CASH', amount: 10 } as never).expect(400);
    expect(noReceived.body).toMatchObject({ code: 'VALIDATION_ERROR', details: { receivedAmount: 'Indica el monto recibido' } });
    await pay(cashier, order.id, { method: 'CASH', amount: 10, receivedAmount: 10, reference: 'X' }).expect(400);
    await pay(cashier, order.id, { method: 'CARD', amount: 10.005 }).expect(400);
    await cashier.post(`/api/billing/accounts/${order.id}/payments`).send({ method: 'CARD', amount: 10 }).expect(400);
    await cashier.get(`/api/billing/accounts/${randomUUID()}`).expect(404);
  });

  it('una cuenta con total cero se cierra sin cobro y libera la mesa; con saldo no (FR-009)', async () => {
    const waiter = await user('WAITER');
    const zero = await createBillableOrder(prisma, {
      waiterId: waiter.id,
      tableNumber: 8,
      items: [{ price: 30, quantity: 2, voidedQuantity: 2 }],
    });
    const withBalance = await createBillableOrder(prisma, { waiterId: waiter.id, tableNumber: 9, items: [{ price: 30, quantity: 1 }] });
    const cashier = await cashierAgent();

    const detail = await cashier.get(`/api/billing/accounts/${zero.order.id}`).expect(200);
    expect(detail.body).toMatchObject({ total: { formatted: 'S/ 0.00' }, canCharge: false, canCloseWithoutCharge: true });

    const closed = await cashier.post(`/api/billing/accounts/${zero.order.id}/close-without-charge`).expect(200);
    expect(closed.body).toMatchObject({ orderStatus: 'PAID', payments: [] });
    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id: zero.table.id } })).status).toBe('LIBRE');

    const refused = await cashier.post(`/api/billing/accounts/${withBalance.order.id}/close-without-charge`).expect(409);
    expect(refused.body).toMatchObject({ code: 'ACCOUNT_HAS_BALANCE' });
  });
});
