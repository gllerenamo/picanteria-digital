import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IDEMPOTENCY_KEY_HEADER, type KitchenBoard, type Ticket } from '@picanteria/shared';

import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { createUser, loginAs } from '../helpers/factories';
import { addRound, advance, createTicket, voidUnits } from '../helpers/kitchen-factories';
import { createDraftItem, createMenuItem, createOpenOrder } from '../helpers/order-factories';

type TestUser = Awaited<ReturnType<typeof createUser>>;

describe('Feature 004 — tablero de cocina (GET /api/kitchen/board)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let juan: TestUser;
  let kitchen: TestAgent;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = prismaOf(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    juan = await createUser(prisma, { role: 'WAITER', fullName: 'Juan Pérez' });
    kitchen = await loginAs(app, await createUser(prisma, { role: 'KITCHEN' }));
  });

  const getBoard = async (): Promise<KitchenBoard> => (await kitchen.get('/api/kitchen/board').expect(200)).body as KitchenBoard;
  const activeTicket = async (): Promise<Ticket> => {
    const [ticket] = (await getBoard()).active;
    if (!ticket) throw new Error('No hay comandas activas');
    return ticket;
  };
  const admin = async (): Promise<TestAgent> => loginAs(app, await createUser(prisma, { role: 'ADMIN' }));

  it('[004] AC-1.2: las comandas salen por número de envío aunque se registren en otro orden', async () => {
    await createTicket(prisma, juan.id, { tableNumber: 2, sequence: 13 });
    await createTicket(prisma, juan.id, { tableNumber: 4, sequence: 12 });

    const board = await getBoard();

    expect(board.active.map((ticket) => [ticket.sequence, ticket.tableNumber])).toEqual([
      [12, 4],
      [13, 2],
    ]);
  });

  it('[004] AC-1.4: cada comanda trae número, mesa, mozo, hora y, por ítem, cantidad, nombre y nota', async () => {
    const { dispatch } = await createTicket(prisma, juan.id, {
      tableNumber: 5,
      items: [{ name: 'Ají de gallina', quantity: 2, notes: 'sin ají' }],
    });

    const ticket = await activeTicket();

    expect(ticket).toMatchObject({
      dispatchId: dispatch.id,
      sequence: dispatch.sequence,
      tableNumber: 5,
      round: 1,
      sentBy: { id: juan.id, fullName: 'Juan Pérez' },
      sentAt: dispatch.sentAt.toISOString(),
      state: 'ACTIVE',
    });
    expect(ticket.items).toEqual([
      expect.objectContaining({ name: 'Ají de gallina', quantity: 2, toPrepare: 2, notes: 'sin ají', status: 'PENDING' }),
    ]);
  });

  it('[004] AC-1.5: otra ronda de la mesa 3 llega como comanda nueva, con su número y su ronda', async () => {
    const { order, dispatch: first } = await createTicket(prisma, juan.id, { tableNumber: 3 });
    const { dispatch: second } = await addRound(prisma, order);

    const board = await getBoard();

    expect(board.active.map((ticket) => [ticket.sequence, ticket.tableNumber, ticket.round])).toEqual([
      [first.sequence, 3, 1],
      [second.sequence, 3, 2],
    ]);
  });

  it('[004] AC-1.6: reintentar un envío con la misma clave deja una sola comanda', async () => {
    const { order } = await createOpenOrder(prisma, juan.id, { tableNumber: 6 });
    await createDraftItem(prisma, order.id, (await createMenuItem(prisma, { name: 'Adobo' })).id);
    const waiter = await loginAs(app, juan);
    const key = randomUUID();

    await waiter.post(`/api/orders/${order.id}/dispatches`).set(IDEMPOTENCY_KEY_HEADER, key).expect(201);
    await waiter.post(`/api/orders/${order.id}/dispatches`).set(IDEMPOTENCY_KEY_HEADER, key).expect(201);

    const board = await getBoard();
    expect(board.active).toHaveLength(1);
    expect(board.active[0]?.items.map((item) => item.name)).toEqual(['Adobo']);
  });

  it('[004] AC-1.7: un envío con adobo y chicha morada muestra los dos, bebidas incluidas', async () => {
    await createTicket(prisma, juan.id, { items: [{ name: 'Adobo' }, { name: 'Chicha morada', quantity: 2 }] });

    const ticket = await activeTicket();

    expect(ticket.items.map((item) => [item.name, item.quantity])).toEqual([
      ['Adobo', 1],
      ['Chicha morada', 2],
    ]);
  });

  it('[004] AC-2.4: al quedar listo el último plato, la comanda pasa a "Completadas" y sale a los 30 min', async () => {
    const { dispatch, items } = await createTicket(prisma, juan.id, { items: [{ status: 'PREPARING' }] });
    const [item] = items;
    if (!item) throw new Error('Falta el ítem');

    await advance(kitchen, item.id, 'PREPARING').expect(200);
    let board = await getBoard();
    expect(board.active).toEqual([]);
    expect(board.completed.map((ticket) => [ticket.dispatchId, ticket.state])).toEqual([[dispatch.id, 'COMPLETED']]);
    expect(board.completed[0]?.completedAt).not.toBeNull();

    // 31 minutos después de completarse ya no aparece.
    await prisma.orderItemStatusChange.updateMany({ data: { changedAt: new Date(Date.now() - 31 * 60_000) } });
    await prisma.kitchenDispatch.update({ where: { id: dispatch.id }, data: { sentAt: new Date(Date.now() - 40 * 60_000) } });
    board = await getBoard();
    expect(board.completed).toEqual([]);
  });

  it('[004] AC-4.3: una comanda completada trae la hora en que se completó para calcular su tiempo total', async () => {
    const { dispatch, items } = await createTicket(prisma, juan.id, { items: [{ status: 'PREPARING' }] });
    const [item] = items;
    if (!item) throw new Error('Falta el ítem');

    await advance(kitchen, item.id, 'PREPARING').expect(200);

    const [ticket] = (await getBoard()).completed;
    const readyChange = await prisma.orderItemStatusChange.findFirstOrThrow({ where: { orderItemId: item.id, toStatus: 'READY' } });
    expect(ticket?.completedAt).toBe(readyChange.changedAt.toISOString());
    expect(Date.parse(ticket?.completedAt ?? '') - Date.parse(ticket?.sentAt ?? '')).toBe(
      readyChange.changedAt.getTime() - dispatch.sentAt.getTime(),
    );
  });

  it('[004] AC-5.1: un plato anulado por completo aparece anulado y ya no se puede avanzar', async () => {
    const { items } = await createTicket(prisma, juan.id, { items: [{ name: 'Chupe de camarones' }, { name: 'Adobo' }] });
    const [chupe] = items;
    if (!chupe) throw new Error('Falta el ítem');

    await voidUnits(await admin(), chupe.id, 1);

    const ticket = await activeTicket();
    expect(ticket.items[0]).toMatchObject({ name: 'Chupe de camarones', status: 'VOIDED', toPrepare: 0, canUndo: false });
    const response = await advance(kitchen, chupe.id, 'PENDING').expect(409);
    expect(response.body).toMatchObject({ code: 'ITEM_VOIDED', message: 'Este plato fue anulado' });
  });

  it('[004] AC-5.2: anular 1 de 3 rocotos en preparación deja 2 por preparar con el mismo estado', async () => {
    const { items } = await createTicket(prisma, juan.id, { items: [{ name: 'Rocoto relleno', quantity: 3, status: 'PREPARING' }] });
    const [rocoto] = items;
    if (!rocoto) throw new Error('Falta el ítem');

    await voidUnits(await admin(), rocoto.id, 1);

    const ticket = await activeTicket();
    expect(ticket.items[0]).toMatchObject({ quantity: 3, voidedQuantity: 1, toPrepare: 2, status: 'PREPARING' });
    await advance(kitchen, rocoto.id, 'PREPARING').expect(200);
  });

  it('[004] AC-5.3: con un plato anulado, la comanda se completa al quedar listos los demás', async () => {
    const { dispatch, items } = await createTicket(prisma, juan.id, { items: [{ name: 'Adobo', status: 'PREPARING' }, { name: 'Chupe' }] });
    const [adobo, chupe] = items;
    if (!adobo || !chupe) throw new Error('Faltan ítems');
    await voidUnits(await admin(), chupe.id, 1);

    await advance(kitchen, adobo.id, 'PREPARING').expect(200);

    const board = await getBoard();
    expect(board.active).toEqual([]);
    expect(board.completed.map((ticket) => ticket.dispatchId)).toEqual([dispatch.id]);
  });

  it('[004] AC-5.4: una comanda totalmente anulada sigue visible hasta confirmar todas sus anulaciones', async () => {
    const { dispatch, items } = await createTicket(prisma, juan.id, { items: [{ name: 'Adobo' }, { name: 'Chupe' }] });
    const adminAgent = await admin();
    for (const item of items) await voidUnits(adminAgent, item.id, 1);

    let board = await getBoard();
    expect(board.active.map((ticket) => [ticket.dispatchId, ticket.state])).toEqual([[dispatch.id, 'VOIDED']]);
    expect(board.voidNotices).toHaveLength(2);

    const [first, second] = board.voidNotices;
    await kitchen.post(`/api/kitchen/void-notices/${first?.itemVoidId ?? ''}/ack`).expect(204);
    expect((await getBoard()).active).toHaveLength(1);
    await kitchen.post(`/api/kitchen/void-notices/${second?.itemVoidId ?? ''}/ack`).expect(204);

    board = await getBoard();
    expect(board.active).toEqual([]);
    expect(board.completed).toEqual([]);
  });

  it('mozo y cajero no pueden ver el tablero de cocina', async () => {
    for (const role of ['WAITER', 'CASHIER'] as const) {
      const agent = await loginAs(app, await createUser(prisma, { role }));
      const response = await agent.get('/api/kitchen/board').expect(403);
      expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
    }
  });
});
