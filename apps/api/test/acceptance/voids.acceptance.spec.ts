import type { NestExpressApplication } from '@nestjs/platform-express';
import type { OrderDetail, VoidResult } from '@picanteria/shared';
import type { KitchenDispatch, MenuItem, User } from '@prisma/client';
import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { createUser, loginAs } from '../helpers/factories';
import { createDispatch, createDraftItem, createMenuItem, createOpenOrder, createSentItem } from '../helpers/order-factories';

describe('Feature 003 — US5: anular un ítem ya enviado con autorización', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: User & { password: string };
  let waiter: User & { password: string };
  let adminAgent: TestAgent;
  let orderId: string;
  let dispatch: KitchenDispatch;
  let rocoto: MenuItem;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = prismaOf(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    admin = await createUser(prisma, { role: 'ADMIN', fullName: 'Administradora' });
    waiter = await createUser(prisma, { role: 'WAITER' });
    adminAgent = await loginAs(app, admin);
    const { order } = await createOpenOrder(prisma, waiter.id);
    orderId = order.id;
    dispatch = await createDispatch(prisma, order.id, waiter.id);
    rocoto = await createMenuItem(prisma, { name: 'Rocoto Relleno', price: 28 });
  });

  const voidItem = (agent: TestAgent, itemId: string, body: Record<string, unknown>) =>
    agent.post(`/api/order-items/${itemId}/voids`).send(body);

  it('[003] AC-5.1: el administrador anula un ítem pendiente o en preparación y queda registrado quién, cuándo y por qué', async () => {
    for (const status of ['PENDING', 'PREPARING'] as const) {
      const item = await createSentItem(prisma, dispatch, rocoto, { quantity: 2, status });

      const result = (await voidItem(adminAgent, item.id, { units: 2, reason: 'El cliente se retiró' }).expect(201))
        .body as VoidResult;

      expect(result.item).toMatchObject({ status: 'VOIDED', voidedQuantity: 2, activeQuantity: 0 });
      expect(result.itemVoid).toMatchObject({ units: 2, reason: 'El cliente se retiró', voidedBy: { id: admin.id } });
      const saved = await prisma.itemVoid.findFirstOrThrow({ where: { orderItemId: item.id } });
      expect(saved).toMatchObject({ voidedById: admin.id, reason: 'El cliente se retiró', units: 2 });
      expect(saved.voidedAt).toBeInstanceOf(Date);
    }
  });

  it('[003] AC-5.3: sin motivo no se anula y se pide el motivo', async () => {
    const item = await createSentItem(prisma, dispatch, rocoto);

    const missing: unknown = (await voidItem(adminAgent, item.id, { units: 1 }).expect(400)).body;
    expect(missing).toMatchObject({ code: 'VALIDATION_ERROR', details: { reason: 'Indica el motivo de la anulación' } });
    await voidItem(adminAgent, item.id, { units: 1, reason: 'ab' }).expect(400);

    expect(await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ status: 'PENDING', voidedQuantity: 0 });
    expect(await prisma.itemVoid.count()).toBe(0);
  });

  it('[003] AC-5.4: un plato listo no se anula y se explica por qué', async () => {
    const ready = await createSentItem(prisma, dispatch, rocoto, { status: 'READY' });
    const body: unknown = (await voidItem(adminAgent, ready.id, { units: 1, reason: 'Pedido por error' }).expect(409)).body;
    expect(body).toEqual({
      code: 'ITEM_NOT_VOIDABLE',
      message: 'El plato ya está listo; no se puede anular',
      details: { reason: 'READY', remainingQuantity: 1 },
    });

    const voided = await createSentItem(prisma, dispatch, rocoto, { status: 'VOIDED', voidedQuantity: 1 });
    const draft = await createDraftItem(prisma, orderId, rocoto.id);
    const three = await createSentItem(prisma, dispatch, rocoto, { quantity: 3, voidedQuantity: 1 });
    for (const [itemId, units, reason] of [
      [voided.id, 1, 'VOIDED'],
      [draft.id, 1, 'NOT_SENT'],
      [three.id, 3, 'NOT_ENOUGH_UNITS'],
    ] as const) {
      const response: unknown = (await voidItem(adminAgent, itemId, { units, reason: 'Pedido por error' }).expect(409)).body;
      expect(response).toMatchObject({ code: 'ITEM_NOT_VOIDABLE', details: { reason } });
    }
  });

  it('[003] AC-5.5: quien no es administrador no puede anular', async () => {
    const item = await createSentItem(prisma, dispatch, rocoto);
    for (const role of ['WAITER', 'KITCHEN', 'CASHIER'] as const) {
      const agent = await loginAs(app, await createUser(prisma, { role }));
      await voidItem(agent, item.id, { units: 1, reason: 'Pedido por error' }).expect(403);
    }
    expect(await prisma.itemVoid.count()).toBe(0);
  });

  it('[003] AC-5.6: lo anulado aparece como anulado y no suma al consumo', async () => {
    const kept = await createSentItem(prisma, dispatch, rocoto);
    const voided = await createSentItem(prisma, dispatch, rocoto);
    await voidItem(adminAgent, voided.id, { units: 1, reason: 'Pedido por error' }).expect(201);

    const order = (await adminAgent.get(`/api/orders/${orderId}`).expect(200)).body as OrderDetail;

    expect(order.items.find((item) => item.id === voided.id)?.status).toBe('VOIDED');
    expect(order.items.find((item) => item.id === kept.id)?.status).toBe('PENDING');
    expect(order.consumption.total.formatted).toBe('S/ 28.00');
  });

  it('[003] AC-5.7: anular 1 de 3 unidades deja el ítem en curso con 2 y el consumo con 2', async () => {
    const item = await createSentItem(prisma, dispatch, rocoto, { quantity: 3, status: 'PREPARING' });

    const partial = (await voidItem(adminAgent, item.id, { units: 1, reason: 'Solo quieren dos' }).expect(201)).body as VoidResult;
    expect(partial.item).toMatchObject({ status: 'PREPARING', voidedQuantity: 1, activeQuantity: 2 });
    const order = (await adminAgent.get(`/api/orders/${orderId}`).expect(200)).body as OrderDetail;
    expect(order.consumption.total.formatted).toBe('S/ 56.00');

    const rest = (await voidItem(adminAgent, item.id, { units: 2, reason: 'Ya no quieren' }).expect(201)).body as VoidResult;
    expect(rest.item).toMatchObject({ status: 'VOIDED', voidedQuantity: 3, activeQuantity: 0 });
  });

  it('una anulación y un "Listo" simultáneos terminan en un estado coherente', async () => {
    const item = await createSentItem(prisma, dispatch, rocoto, { status: 'PREPARING' });

    // El "Listo" de cocina (004) es una actualización condicionada por el estado.
    const [voidResponse, readyCount] = await Promise.all([
      voidItem(adminAgent, item.id, { units: 1, reason: 'Pedido por error' }),
      prisma.$executeRaw`UPDATE order_items SET status = 'READY', updated_at = now() WHERE id = ${item.id}::uuid AND status = 'PREPARING'`,
    ]);

    const final = await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } });
    if (final.status === 'VOIDED') {
      expect(voidResponse.status).toBe(201);
      expect(readyCount).toBe(0);
    } else {
      expect(final).toMatchObject({ status: 'READY', voidedQuantity: 0 });
      expect(voidResponse.status).toBe(409);
    }
  });
});
