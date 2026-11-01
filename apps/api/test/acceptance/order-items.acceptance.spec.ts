import type { NestExpressApplication } from '@nestjs/platform-express';
import type { CategoryWithItemsResponse, OrderDetail, OrderItemResponse } from '@picanteria/shared';
import type { User } from '@prisma/client';
import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { RealtimeGateway } from '../../src/realtime/realtime.gateway';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { createUser, loginAs } from '../helpers/factories';
import { createDispatch, createDraftItem, createMenuItem, createOpenOrder, createSentItem } from '../helpers/order-factories';

describe('Feature 003 — US2: tomar el pedido (y consumo de US6)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let juan: User & { password: string };
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
    const rosa = await createUser(prisma, { role: 'WAITER', fullName: 'Rosa Quispe' });
    juanAgent = await loginAs(app, juan);
    rosaAgent = await loginAs(app, rosa);
  });

  const detail = async (orderId: string): Promise<OrderDetail> =>
    (await juanAgent.get(`/api/orders/${orderId}`).expect(200)).body as OrderDetail;

  it('[003] AC-2.1: la carta para tomar pedidos trae solo lo disponible, con su precio en soles', async () => {
    await createMenuItem(prisma, { name: 'Rocoto Relleno', price: 24.5 });
    await createMenuItem(prisma, { name: 'Chupe de Camarones', isAvailable: false });
    await createMenuItem(prisma, { name: 'Plato retirado', isActive: false });

    const tree = (await juanAgent.get('/api/menu/tree?availableOnly=true').expect(200)).body as CategoryWithItemsResponse[];
    const items = tree.flatMap((category) => category.items);

    expect(items.map((item) => item.name)).toEqual(['Rocoto Relleno']);
    expect(items[0]?.priceFormatted).toBe('S/ 24.50');
  });

  it('[003] AC-2.2: un plato no disponible no se puede agregar', async () => {
    const { order } = await createOpenOrder(prisma, juan.id);
    const soldOut = await createMenuItem(prisma, { isAvailable: false });

    const body: unknown = (
      await juanAgent.post(`/api/orders/${order.id}/items`).send({ menuItemId: soldOut.id, quantity: 1 }).expect(409)
    ).body;
    expect(body).toMatchObject({ code: 'MENU_ITEM_UNAVAILABLE' });
    expect(await prisma.orderItem.count()).toBe(0);
  });

  it('[003] AC-2.3: se agrega un plato con cantidad y nota, como no enviado', async () => {
    const { order } = await createOpenOrder(prisma, juan.id);
    const rocoto = await createMenuItem(prisma, { name: 'Rocoto Relleno', price: 24.5 });

    const item = (
      await juanAgent
        .post(`/api/orders/${order.id}/items`)
        .send({ menuItemId: rocoto.id, quantity: 2, notes: 'sin ají' })
        .expect(201)
    ).body as OrderItemResponse;

    expect(item).toMatchObject({
      status: 'DRAFT',
      quantity: 2,
      notes: 'sin ají',
      unitPrice: null,
      currentPrice: { formatted: 'S/ 24.50' },
      isAvailable: true,
    });
  });

  it('[003] AC-2.4: el mismo plato con otra nota queda como otro ítem', async () => {
    const { order } = await createOpenOrder(prisma, juan.id);
    const rocoto = await createMenuItem(prisma);

    await juanAgent.post(`/api/orders/${order.id}/items`).send({ menuItemId: rocoto.id, quantity: 1, notes: 'sin ají' }).expect(201);
    await juanAgent.post(`/api/orders/${order.id}/items`).send({ menuItemId: rocoto.id, quantity: 2, notes: 'bien cocido' }).expect(201);

    const { items } = await detail(order.id);
    expect(items.map((item) => [item.quantity, item.notes])).toEqual([
      [1, 'sin ají'],
      [2, 'bien cocido'],
    ]);
  });

  it('[003] AC-2.5: cualquier mozo cambia la cantidad o la nota de un borrador sin autorización', async () => {
    const { order } = await createOpenOrder(prisma, juan.id);
    const draft = await createDraftItem(prisma, order.id, (await createMenuItem(prisma)).id);

    await rosaAgent.patch(`/api/order-items/${draft.id}`).send({ quantity: 3 }).expect(200);
    const updated = (await rosaAgent.patch(`/api/order-items/${draft.id}`).send({ notes: 'sin cebolla' }).expect(200))
      .body as OrderItemResponse;
    expect(updated).toMatchObject({ quantity: 3, notes: 'sin cebolla' });

    await rosaAgent.patch(`/api/order-items/${draft.id}`).send({ quantity: 0 }).expect(400);
    await rosaAgent.patch(`/api/order-items/${draft.id}`).send({ notes: 'x'.repeat(141) }).expect(400);
  });

  it('[003] AC-2.6: quitar un borrador lo borra y la cocina no recibe nada', async () => {
    const { order } = await createOpenOrder(prisma, juan.id);
    const draft = await createDraftItem(prisma, order.id, (await createMenuItem(prisma)).id);
    const emitted = jest.spyOn(app.get(RealtimeGateway), 'emitToRoles');

    await juanAgent.delete(`/api/order-items/${draft.id}`).expect(204);

    expect((await detail(order.id)).items).toEqual([]);
    expect(await prisma.kitchenDispatch.count()).toBe(0);
    expect(emitted).not.toHaveBeenCalled();
    emitted.mockRestore();
  });

  it('[003] AC-2.7: los borradores de una mesa siguen igual tras atender otra', async () => {
    const menuItem = await createMenuItem(prisma);
    const { order: first } = await createOpenOrder(prisma, juan.id);
    const { order: second } = await createOpenOrder(prisma, juan.id);
    await juanAgent.post(`/api/orders/${first.id}/items`).send({ menuItemId: menuItem.id, quantity: 2, notes: 'sin ají' }).expect(201);

    await juanAgent.post(`/api/orders/${second.id}/items`).send({ menuItemId: menuItem.id, quantity: 1 }).expect(201);

    const { items } = await detail(first.id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ status: 'DRAFT', quantity: 2, notes: 'sin ají' });
  });

  it('[003] AC-6.2: el consumo muestra cantidad vigente, precio, subtotal y total en soles', async () => {
    const { order, table } = await createOpenOrder(prisma, juan.id);
    const rocoto = await createMenuItem(prisma, { price: 28 });
    const chicha = await createMenuItem(prisma, { price: 10 });
    const dispatch = await createDispatch(prisma, order.id, juan.id);
    await createSentItem(prisma, dispatch, rocoto, { quantity: 2 });
    await createSentItem(prisma, dispatch, chicha, { quantity: 3, voidedQuantity: 1 });
    await createSentItem(prisma, dispatch, chicha, { quantity: 1, voidedQuantity: 1, status: 'VOIDED' });

    for (const status of ['OCUPADA', 'POR_COBRAR'] as const) {
      await prisma.diningTable.update({ where: { id: table.id }, data: { status } });
      const { items, consumption } = await detail(order.id);
      expect(consumption.total.formatted).toBe('S/ 76.00');
      expect(items.filter((item) => item.status !== 'VOIDED').map((item) => [item.activeQuantity, item.unitPrice?.formatted, item.subtotal?.formatted])).toEqual([
        [2, 'S/ 28.00', 'S/ 56.00'],
        [2, 'S/ 10.00', 'S/ 20.00'],
      ]);
    }
  });

  it('[003] AC-6.7: agregar con la mesa por cobrar exige confirmar y la devuelve a ocupada', async () => {
    const { order, table } = await createOpenOrder(prisma, juan.id, { tableStatus: 'POR_COBRAR' });
    const chicha = await createMenuItem(prisma);

    const body: unknown = (
      await juanAgent.post(`/api/orders/${order.id}/items`).send({ menuItemId: chicha.id, quantity: 1 }).expect(409)
    ).body;
    expect(body).toMatchObject({ code: 'TABLE_AWAITING_PAYMENT' });

    await juanAgent
      .post(`/api/orders/${order.id}/items`)
      .send({ menuItemId: chicha.id, quantity: 1, confirmReopen: true })
      .expect(201);

    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id: table.id } })).status).toBe('OCUPADA');
    const reopened = await detail(order.id);
    expect(reopened.table.status).toBe('OCUPADA');
    // Para cobrarla hay que pedir la cuenta otra vez (y antes enviar lo nuevo).
    expect(reopened.canRequestBill).toBe(false);
  });
});
