import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AccountDetail } from '@picanteria/shared';
import type { User } from '@prisma/client';
import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { createBillableOrder, pay } from '../helpers/billing-factories';
import { resetDb } from '../helpers/db';
import { createUser, loginAs } from '../helpers/factories';
import { createMenuItem } from '../helpers/order-factories';

describe('Feature 005 — dividir la cuenta entre varios clientes', () => {
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

  const split = (agent: TestAgent, orderId: string, body: object) =>
    agent.post(`/api/billing/accounts/${orderId}/split`).send(body);

  /** Cuenta de S/ 100.00: 2 × S/ 30.00 (Ceviche) y 1 × S/ 40.00 (Chupe). */
  async function hundred() {
    const waiter = await user('WAITER');
    const created = await createBillableOrder(prisma, {
      waiterId: waiter.id,
      tableNumber: 3,
      items: [
        { name: 'Ceviche', price: 30, quantity: 2 },
        { name: 'Chupe de Camarones', price: 40, quantity: 1 },
      ],
    });
    const [ceviche, chupe] = created.items;
    if (!ceviche || !chupe) throw new Error('Faltan ítems');
    return { ...created, waiter, ceviche, chupe, cashier: await loginAs(app, await user('CASHIER')) };
  }

  it('[005] AC-2.1: en 3 partes iguales, S/ 100.00 queda en 33.34, 33.33 y 33.33', async () => {
    const { order, cashier } = await hundred();

    const response = await split(cashier, order.id, { mode: 'EQUAL', parts: 3 }).expect(200);
    const account = response.body as AccountDetail;

    expect(account.split).toMatchObject({ mode: 'EQUAL', isStale: false });
    expect(account.split?.parts.map((part) => [part.label, part.amount.formatted])).toEqual([
      ['Parte 1', 'S/ 33.34'],
      ['Parte 2', 'S/ 33.33'],
      ['Parte 3', 'S/ 33.33'],
    ]);
  });

  it('[005] AC-2.2: por ítems, cada parte tiene sus ítems y monto; no se confirma con unidades sin asignar ni ajenas', async () => {
    const { order, cashier, ceviche, chupe, waiter } = await hundred();

    const unassigned = await split(cashier, order.id, {
      mode: 'BY_ITEMS',
      parts: [{ items: [{ orderItemId: ceviche.id, units: 1 }] }, { items: [{ orderItemId: chupe.id, units: 1 }] }],
    }).expect(409);
    expect(unassigned.body).toMatchObject({ code: 'SPLIT_UNASSIGNED_UNITS', details: { unassigned: 1 } });

    const tooMany = await split(cashier, order.id, {
      mode: 'BY_ITEMS',
      parts: [{ items: [{ orderItemId: ceviche.id, units: 3 }] }, { items: [{ orderItemId: chupe.id, units: 1 }] }],
    }).expect(409);
    expect(tooMany.body).toMatchObject({ code: 'SPLIT_INVALID_ASSIGNMENT' });

    const other = await createBillableOrder(prisma, { waiterId: waiter.id, tableNumber: 9, items: [{ price: 5, quantity: 1 }] });
    const foreign = await split(cashier, order.id, {
      mode: 'BY_ITEMS',
      parts: [
        { items: [{ orderItemId: ceviche.id, units: 2 }, { orderItemId: other.items[0]?.id, units: 1 }] },
        { items: [{ orderItemId: chupe.id, units: 1 }] },
      ],
    }).expect(409);
    expect(foreign.body).toMatchObject({ code: 'SPLIT_INVALID_ASSIGNMENT' });
    expect(await prisma.billSplit.count()).toBe(0);

    const response = await split(cashier, order.id, {
      mode: 'BY_ITEMS',
      parts: [
        { label: 'Ana', items: [{ orderItemId: ceviche.id, units: 2 }] },
        { items: [{ orderItemId: chupe.id, units: 1 }] },
      ],
    }).expect(200);
    const account = response.body as AccountDetail;
    expect(account.split?.parts).toEqual([
      expect.objectContaining({ label: 'Ana', amount: { amount: 60, formatted: 'S/ 60.00' }, items: [{ orderItemId: ceviche.id, name: 'Ceviche', units: 2 }] }),
      expect.objectContaining({ label: 'Parte 2', amount: { amount: 40, formatted: 'S/ 40.00' } }),
    ]);
  });

  it('[005] AC-2.3: pagar una parte la deja pagada, actualiza el saldo y la mesa sigue por cobrar', async () => {
    const { order, table, cashier } = await hundred();
    const parts = ((await split(cashier, order.id, { mode: 'EQUAL', parts: 2 }).expect(200)).body as AccountDetail).split?.parts ?? [];

    const response = await pay(cashier, order.id, { method: 'CASH', amount: 50, receivedAmount: 50, partId: parts[0]?.id }).expect(201);
    const account = response.body as AccountDetail;

    expect(account.orderStatus).toBe('OPEN');
    expect(account.pending.formatted).toBe('S/ 50.00');
    expect(account.split?.parts[0]).toMatchObject({ paid: { formatted: 'S/ 50.00' }, pending: { formatted: 'S/ 0.00' } });
    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id: table.id } })).status).toBe('POR_COBRAR');

    const overPart = await pay(cashier, order.id, { method: 'CARD', amount: 50, partId: parts[0]?.id }).expect(409);
    expect(overPart.body).toMatchObject({ code: 'PAYMENT_EXCEEDS_BALANCE' });
  });

  it('[005] AC-2.4: al pagar la última parte con otro método, la cuenta queda pagada y la mesa libre', async () => {
    const { order, table, cashier } = await hundred();
    const parts = ((await split(cashier, order.id, { mode: 'EQUAL', parts: 3 }).expect(200)).body as AccountDetail).split?.parts ?? [];

    await pay(cashier, order.id, { method: 'CASH', amount: 33.34, receivedAmount: 40, partId: parts[0]?.id }).expect(201);
    await pay(cashier, order.id, { method: 'YAPE_PLIN', amount: 33.33, partId: parts[1]?.id }).expect(201);
    const last = await pay(cashier, order.id, { method: 'CARD', amount: 33.33, partId: parts[2]?.id }).expect(201);

    expect((last.body as AccountDetail).orderStatus).toBe('PAID');
    expect((last.body as AccountDetail).payments.map((payment) => payment.method)).toEqual(['CASH', 'YAPE_PLIN', 'CARD']);
    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id: table.id } })).status).toBe('LIBRE');
  });

  it('[005] AC-2.5: con pagos parciales, Yape/Plin o tarjeta por encima del saldo no se registra e indica el saldo', async () => {
    const { order, cashier } = await hundred();
    await pay(cashier, order.id, { method: 'CASH', amount: 30, receivedAmount: 30 }).expect(201);

    for (const method of ['YAPE_PLIN', 'CARD'] as const) {
      const response = await pay(cashier, order.id, { method, amount: 80 }).expect(409);
      expect(response.body).toMatchObject({
        code: 'PAYMENT_EXCEEDS_BALANCE',
        message: 'El monto supera el saldo pendiente',
        details: { pending: 'S/ 70.00' },
      });
    }
    expect(await prisma.payment.count()).toBe(1);
  });

  it('[005] AC-2.6: si piden algo más, los pagos se conservan, el saldo incluye lo agregado y la división queda desactualizada', async () => {
    const { order, cashier, waiter } = await hundred();
    const parts = ((await split(cashier, order.id, { mode: 'EQUAL', parts: 2 }).expect(200)).body as AccountDetail).split?.parts ?? [];
    await pay(cashier, order.id, { method: 'YAPE_PLIN', amount: 50, partId: parts[0]?.id }).expect(201);

    // El mozo agrega una chicha (003 FR-034), la envía y vuelve a pedir la cuenta.
    const waiterAgent = await loginAs(app, waiter);
    const chicha = await createMenuItem(prisma, { name: 'Chicha Morada', price: 6.5 });
    await waiterAgent.post(`/api/orders/${order.id}/items`).send({ menuItemId: chicha.id, quantity: 2, confirmReopen: true }).expect(201);
    await waiterAgent.post(`/api/orders/${order.id}/dispatches`).set('Idempotency-Key', randomUUID()).expect(201);
    await waiterAgent.post(`/api/orders/${order.id}/request-bill`).expect(200);

    const account = (await cashier.get(`/api/billing/accounts/${order.id}`).expect(200)).body as AccountDetail;
    expect(account.payments).toHaveLength(1);
    expect(account.total.formatted).toBe('S/ 113.00');
    expect(account.pending.formatted).toBe('S/ 63.00');
    expect(account.split?.isStale).toBe(true);
    expect(account.canCharge).toBe(false);

    const stale = await pay(cashier, order.id, { method: 'CARD', amount: 50, partId: parts[1]?.id }).expect(409);
    expect(stale.body).toMatchObject({ code: 'SPLIT_STALE' });

    const again = (await split(cashier, order.id, { mode: 'EQUAL', parts: 2 }).expect(200)).body as AccountDetail;
    expect(again.split?.parts.map((part) => part.amount.formatted)).toEqual(['S/ 31.50', 'S/ 31.50']);
    expect(again.canCharge).toBe(true);
  });

  it('[005] AC-2.7: un pago anulado con motivo deja de contar y queda registrado; en una cuenta pagada no se anula', async () => {
    const { order, cashier } = await hundred();
    const created = (await pay(cashier, order.id, { method: 'CARD', amount: 40 }).expect(201)).body as AccountDetail;
    const paymentId = created.payments[0]?.id ?? '';

    const shortReason = await cashier.post(`/api/billing/accounts/${order.id}/payments/${paymentId}/void`).send({ reason: 'x' }).expect(400);
    expect(shortReason.body).toMatchObject({ code: 'VALIDATION_ERROR' });

    const response = await cashier
      .post(`/api/billing/accounts/${order.id}/payments/${paymentId}/void`)
      .send({ reason: 'Se cobró a la mesa equivocada' })
      .expect(200);
    const account = response.body as AccountDetail;
    expect(account.paid.formatted).toBe('S/ 0.00');
    expect(account.pending.formatted).toBe('S/ 100.00');
    expect(account.payments[0]).toMatchObject({
      status: 'VOIDED',
      voidReason: 'Se cobró a la mesa equivocada',
    });
    expect(account.payments[0]?.voidedBy).not.toBeNull();

    const twice = await cashier.post(`/api/billing/accounts/${order.id}/payments/${paymentId}/void`).send({ reason: 'Otra vez' }).expect(409);
    expect(twice.body).toMatchObject({ code: 'PAYMENT_NOT_VOIDABLE' });

    const paid = (await pay(cashier, order.id, { method: 'CARD', amount: 100 }).expect(201)).body as AccountDetail;
    const lastId = paid.payments[1]?.id ?? '';
    const closed = await cashier.post(`/api/billing/accounts/${order.id}/payments/${lastId}/void`).send({ reason: 'Error del cajero' }).expect(409);
    expect(closed.body).toMatchObject({ code: 'PAYMENT_NOT_VOIDABLE', message: 'Este pago ya no se puede anular' });
  });

  it('volver a dividir reemplaza la división anterior y reparte solo el saldo pendiente', async () => {
    const { order, cashier, ceviche, chupe } = await hundred();
    const first = ((await split(cashier, order.id, {
      mode: 'BY_ITEMS',
      parts: [{ items: [{ orderItemId: ceviche.id, units: 2 }] }, { items: [{ orderItemId: chupe.id, units: 1 }] }],
    }).expect(200)).body as AccountDetail).split;
    await pay(cashier, order.id, { method: 'CARD', amount: 60, partId: first?.parts[0]?.id }).expect(201);

    // Solo queda el chupe sin pagar: se puede repartir por ítems o en partes iguales.
    const byItems = await split(cashier, order.id, {
      mode: 'BY_ITEMS',
      parts: [{ items: [{ orderItemId: ceviche.id, units: 1 }] }, { items: [{ orderItemId: chupe.id, units: 1 }] }],
    }).expect(409);
    expect(byItems.body).toMatchObject({ code: 'SPLIT_INVALID_ASSIGNMENT' });

    const response = await split(cashier, order.id, { mode: 'EQUAL', parts: 4 }).expect(200);
    const account = response.body as AccountDetail;
    expect(account.split?.id).not.toBe(first?.id);
    expect(account.split?.parts.map((part) => part.amount.formatted)).toEqual(['S/ 10.00', 'S/ 10.00', 'S/ 10.00', 'S/ 10.00']);
    expect(account.items.find((item) => item.orderItemId === ceviche.id)?.paidUnits).toBe(2);
    expect(await prisma.billSplit.count({ where: { orderId: order.id, supersededAt: null } })).toBe(1);
  });
});
