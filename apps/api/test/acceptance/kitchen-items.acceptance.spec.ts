import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TicketItem } from '@picanteria/shared';
import type { OrderItem } from '@prisma/client';
import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { createUser, loginAs } from '../helpers/factories';
import { advance, createTicket, undo, type ItemSpec } from '../helpers/kitchen-factories';

type TestUser = Awaited<ReturnType<typeof createUser>>;

describe('Feature 004 — estados de los platos (POST /api/kitchen/items/:id/advance y /undo)', () => {
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
    juan = await createUser(prisma, { role: 'WAITER' });
    kitchen = await loginAs(app, await createUser(prisma, { role: 'KITCHEN' }));
  });

  const oneItem = async (spec: ItemSpec = {}): Promise<OrderItem> => {
    const { items } = await createTicket(prisma, juan.id, { items: [spec] });
    const [item] = items;
    if (!item) throw new Error('Falta el ítem');
    return item;
  };
  const statusOf = async (itemId: string) => (await prisma.orderItem.findUniqueOrThrow({ where: { id: itemId } })).status;
  const history = (itemId: string) =>
    prisma.orderItemStatusChange.findMany({ where: { orderItemId: itemId }, orderBy: { changedAt: 'asc' } });

  it('[004] AC-2.1: "Preparar" pasa un plato pendiente a En preparación y registra la hora', async () => {
    const item = await oneItem();

    const response = await advance(kitchen, item.id, 'PENDING').expect(200);

    expect(response.body as TicketItem).toMatchObject({ id: item.id, status: 'PREPARING', canUndo: true });
    expect(await statusOf(item.id)).toBe('PREPARING');
    const [change] = await history(item.id);
    expect(change).toMatchObject({ fromStatus: 'PENDING', toStatus: 'PREPARING', isUndo: false });
    expect((response.body as TicketItem).statusChangedAt).toBe(change?.changedAt.toISOString());
  });

  it('[004] AC-2.2: "Listo" pasa un plato en preparación a Listo y registra la hora', async () => {
    const item = await oneItem({ status: 'PREPARING' });

    await advance(kitchen, item.id, 'PREPARING').expect(200);

    expect(await statusOf(item.id)).toBe('READY');
    expect(await history(item.id)).toEqual([expect.objectContaining({ fromStatus: 'PREPARING', toStatus: 'READY' })]);
  });

  it('[004] AC-2.3: un plato pendiente no puede saltar a Listo', async () => {
    const item = await oneItem();
    await advance(kitchen, item.id, 'PENDING').expect(200);

    // La pantalla aún lo mostraba pendiente: el segundo toque no salta a Listo.
    const response = await advance(kitchen, item.id, 'PENDING').expect(409);

    expect(response.body).toMatchObject({ code: 'ITEM_STATE_CONFLICT', details: { current: 'PREPARING' } });
    expect(await statusOf(item.id)).toBe('PREPARING');
  });

  it('[004] AC-2.5: "Deshacer" devuelve el plato a su estado anterior', async () => {
    const item = await oneItem({ status: 'PREPARING' });

    const response = await undo(kitchen, item.id, 'PREPARING').expect(200);

    expect(response.body as TicketItem).toMatchObject({ status: 'PENDING', canUndo: false });
    expect(await history(item.id)).toEqual([expect.objectContaining({ fromStatus: 'PREPARING', toStatus: 'PENDING', isUndo: true })]);
  });

  it('[004] AC-2.7: mozo y cajero no pueden cambiar el estado de un plato', async () => {
    const item = await oneItem();

    for (const role of ['WAITER', 'CASHIER'] as const) {
      const agent = await loginAs(app, await createUser(prisma, { role }));
      const response = await advance(agent, item.id, 'PENDING').expect(403);
      expect(response.body).toEqual({ code: 'FORBIDDEN', message: 'No tienes permiso para realizar esta acción' });
    }
    expect(await statusOf(item.id)).toBe('PENDING');
  });

  it('[004] AC-2.8: un "Listo" cuyo aviso el mozo ya vio no se puede deshacer', async () => {
    const item = await oneItem({ status: 'PREPARING' });
    await advance(kitchen, item.id, 'PREPARING').expect(200);
    const notice = await prisma.readyNotice.findFirstOrThrow({ where: { orderItemId: item.id } });
    await (await loginAs(app, juan)).post(`/api/kitchen/ready-notices/${notice.id}/seen`).expect(204);

    const response = await undo(kitchen, item.id, 'READY').expect(409);

    expect(response.body).toMatchObject({ code: 'READY_ALREADY_SEEN', message: 'El mozo ya recogió este plato' });
    expect(await statusOf(item.id)).toBe('READY');
  });

  it('dos toques simultáneos sobre el mismo plato: se aplica uno y el otro recibe un conflicto', async () => {
    const item = await oneItem();
    const otherKitchen = await loginAs(app, await createUser(prisma, { role: 'KITCHEN' }));

    const results = await Promise.all([advance(kitchen, item.id, 'PENDING'), advance(otherKitchen, item.id, 'PENDING')]);

    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await history(item.id)).toHaveLength(1);
  });

  it('una comanda completada hace más de 30 minutos ya no admite "Deshacer"', async () => {
    const item = await oneItem({ status: 'PREPARING' });
    await advance(kitchen, item.id, 'PREPARING').expect(200);
    await prisma.orderItemStatusChange.updateMany({ data: { changedAt: new Date(Date.now() - 31 * 60_000) } });

    const response = await undo(kitchen, item.id, 'READY').expect(409);

    expect(response.body).toMatchObject({ code: 'UNDO_NOT_ALLOWED' });
  });

  it('un ID inexistente o con formato inválido responde 404', async () => {
    await advance(kitchen, 'no-es-un-id', 'PENDING').expect(404);
    await advance(kitchen, '00000000-0000-4000-8000-000000000000', 'PENDING').expect(404);
  });
});
