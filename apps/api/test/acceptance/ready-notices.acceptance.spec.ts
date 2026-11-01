import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ReadyNotice } from '@picanteria/shared';
import type { OrderItem } from '@prisma/client';
import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { createUser, loginAs } from '../helpers/factories';
import { addRound, advance, createTicket, undo } from '../helpers/kitchen-factories';

type TestUser = Awaited<ReturnType<typeof createUser>>;

describe('Feature 004 — avisos de plato listo (GET /api/kitchen/ready-notices)', () => {
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

  /** Mesa 5 abierta por Juan con 2 ají de gallina en preparación. */
  const readyToServe = async (): Promise<OrderItem> => {
    const { items } = await createTicket(prisma, juan.id, {
      tableNumber: 5,
      items: [{ name: 'Ají de gallina', quantity: 2, status: 'PREPARING' }],
    });
    const [item] = items;
    if (!item) throw new Error('Falta el ítem');
    return item;
  };
  const noticesOf = async (agent: TestAgent): Promise<ReadyNotice[]> =>
    (await agent.get('/api/kitchen/ready-notices').expect(200)).body as ReadyNotice[];

  it('[004] AC-3.2: "Visto" cierra el aviso; repetirlo no falla', async () => {
    const item = await readyToServe();
    await advance(kitchen, item.id, 'PREPARING').expect(200);
    const waiter = await loginAs(app, juan);
    const [notice] = await noticesOf(waiter);

    await waiter.post(`/api/kitchen/ready-notices/${notice?.id ?? ''}/seen`).expect(204);
    await waiter.post(`/api/kitchen/ready-notices/${notice?.id ?? ''}/seen`).expect(204);

    expect(await noticesOf(waiter)).toEqual([]);
  });

  it('[004] AC-3.3: un aviso creado con el mozo desconectado está esperándolo al volver', async () => {
    const item = await readyToServe();
    await advance(kitchen, item.id, 'PREPARING').expect(200);

    const waiter = await loginAs(app, juan);

    expect(await noticesOf(waiter)).toEqual([
      expect.objectContaining({ orderItemId: item.id, tableNumber: 5, itemName: 'Ají de gallina', quantity: 2 }),
    ]);
  });

  it('[004] AC-3.4: deshacer el "Listo" retira el aviso del mozo', async () => {
    const item = await readyToServe();
    await advance(kitchen, item.id, 'PREPARING').expect(200);

    await undo(kitchen, item.id, 'READY').expect(200);

    expect(await noticesOf(await loginAs(app, juan))).toEqual([]);
    const notice = await prisma.readyNotice.findFirstOrThrow({ where: { orderItemId: item.id } });
    expect(notice.withdrawnAt).not.toBeNull();
    expect(notice.seenAt).toBeNull();
  });

  it('[004] AC-3.5: el aviso de una ronda que envió Rosa es para Juan, que abrió la mesa', async () => {
    const rosa = await createUser(prisma, { role: 'WAITER', fullName: 'Rosa Quispe' });
    const { order } = await createTicket(prisma, juan.id, { tableNumber: 5 });
    const { items } = await addRound(prisma, order, { sentById: rosa.id, items: [{ name: 'Adobo', status: 'PREPARING' }] });
    const [adobo] = items;
    if (!adobo) throw new Error('Falta el ítem');

    await advance(kitchen, adobo.id, 'PREPARING').expect(200);

    const rosaAgent = await loginAs(app, rosa);
    expect(await noticesOf(rosaAgent)).toEqual([]);
    const [notice] = await noticesOf(await loginAs(app, juan));
    expect(notice).toMatchObject({ itemName: 'Adobo', tableNumber: 5 });
    await rosaAgent.post(`/api/kitchen/ready-notices/${notice?.id ?? ''}/seen`).expect(403);
  });

  it('cocina no puede consultar los avisos del mozo', async () => {
    await kitchen.get('/api/kitchen/ready-notices').expect(403);
  });
});
