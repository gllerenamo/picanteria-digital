import type { NestExpressApplication } from '@nestjs/platform-express';
import type { KitchenBoard } from '@picanteria/shared';
import type { OrderItem } from '@prisma/client';
import request from 'supertest';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { CSRF, createUser } from '../helpers/factories';
import { addRound, createTicket } from '../helpers/kitchen-factories';
import { connectAs, expectNoEvent, listen, nextEvent, sessionCookie, type TestSocket } from '../helpers/realtime';

type TestUser = Awaited<ReturnType<typeof createUser>>;

describe('Feature 004 — eventos de tiempo real de cocina', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let url: string;
  let juan: TestUser;
  let cook: TestUser;
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
    juan = await createUser(prisma, { role: 'WAITER', fullName: 'Juan Pérez' });
    cook = await createUser(prisma, { role: 'KITCHEN' });
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  const as = async (user: TestUser) => {
    const cookie = await sessionCookie(url, user);
    return {
      post: (path: string, body?: object) => request(url).post(path).set(CSRF).set('Cookie', cookie).send(body),
      get: (path: string) => request(url).get(path).set('Cookie', cookie),
    };
  };
  const oneItem = async (status: 'PENDING' | 'PREPARING'): Promise<OrderItem> => {
    const { items } = await createTicket(prisma, juan.id, { tableNumber: 5, items: [{ name: 'Ají de gallina', quantity: 2, status }] });
    const [item] = items;
    if (!item) throw new Error('Falta el ítem');
    return item;
  };

  it('[004] AC-2.6: otra pantalla de cocina y los mozos ven el cambio de estado sin recargar', async () => {
    const item = await oneItem('PENDING');
    const otherKitchen = await connectAs(url, await createUser(prisma, { role: 'KITCHEN' }), sockets);
    const waiter = await connectAs(url, await createUser(prisma, { role: 'WAITER' }), sockets);
    const kitchenEvent = nextEvent(otherKitchen, 'kitchen:item-status-changed');
    const waiterEvent = nextEvent(waiter, 'kitchen:item-status-changed');

    await (await as(cook)).post(`/api/kitchen/items/${item.id}/advance`, { from: 'PENDING' }).expect(200);

    const expected = { orderItemId: item.id, dispatchId: item.dispatchId, tableNumber: 5, status: 'PREPARING', previousStatus: 'PENDING', isUndo: false };
    await expect(kitchenEvent).resolves.toMatchObject(expected);
    await expect(waiterEvent).resolves.toMatchObject(expected);
  });

  it('[004] AC-3.1: el mozo responsable recibe "2 × Ají de gallina" de la mesa 5 sin recargar', async () => {
    const item = await oneItem('PREPARING');
    const juanSocket = await connectAs(url, juan, sockets);
    const notice = nextEvent(juanSocket, 'kitchen:ready-notice');

    await (await as(cook)).post(`/api/kitchen/items/${item.id}/advance`, { from: 'PREPARING' }).expect(200);

    await expect(notice).resolves.toMatchObject({ orderItemId: item.id, tableNumber: 5, itemName: 'Ají de gallina', quantity: 2 });
  });

  it('[004] AC-3.5: si Rosa envió la ronda, el aviso llega solo a Juan', async () => {
    const rosa = await createUser(prisma, { role: 'WAITER', fullName: 'Rosa Quispe' });
    const { order } = await createTicket(prisma, juan.id, { tableNumber: 5 });
    const { items } = await addRound(prisma, order, { sentById: rosa.id, items: [{ name: 'Adobo', status: 'PREPARING' }] });
    const juanSocket = await connectAs(url, juan, sockets);
    const rosaSocket = await connectAs(url, rosa, sockets);
    const juanNotice = nextEvent(juanSocket, 'kitchen:ready-notice');
    const rosaSilent = expectNoEvent(rosaSocket, 'kitchen:ready-notice');

    await (await as(cook)).post(`/api/kitchen/items/${items[0]?.id ?? ''}/advance`, { from: 'PREPARING' }).expect(200);

    await expect(juanNotice).resolves.toMatchObject({ itemName: 'Adobo' });
    await rosaSilent;
  });

  it('[004] AC-5.5: la anulación aparece como aviso y "Entendido" la quita de todas las pantallas', async () => {
    const { items } = await createTicket(prisma, juan.id, {
      tableNumber: 4,
      items: [{ name: 'Rocoto relleno', quantity: 3, status: 'PREPARING' }],
    });
    const otherKitchen = await connectAs(url, await createUser(prisma, { role: 'KITCHEN' }), sockets);
    const voided = nextEvent(otherKitchen, 'orders:item-voided');
    const admin = await as(await createUser(prisma, { role: 'ADMIN' }));
    await admin.post(`/api/order-items/${items[0]?.id ?? ''}/voids`, { units: 1, reason: 'El cliente cambió de opinión' }).expect(201);
    await voided;

    const kitchen = await as(cook);
    const board = (await kitchen.get('/api/kitchen/board').expect(200)).body as KitchenBoard;
    expect(board.voidNotices).toEqual([expect.objectContaining({ tableNumber: 4, itemName: 'Rocoto relleno', units: 1 })]);
    const [notice] = board.voidNotices;
    const acknowledged = nextEvent(otherKitchen, 'kitchen:void-acknowledged');

    await kitchen.post(`/api/kitchen/void-notices/${notice?.itemVoidId ?? ''}/ack`).expect(204);
    await expect(acknowledged).resolves.toEqual({ itemVoidId: notice?.itemVoidId });
    await kitchen.post(`/api/kitchen/void-notices/${notice?.itemVoidId ?? ''}/ack`).expect(204);
    expect(((await kitchen.get('/api/kitchen/board').expect(200)).body as KitchenBoard).voidNotices).toEqual([]);
  });
});
