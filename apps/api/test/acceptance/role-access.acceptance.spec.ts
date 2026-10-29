import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Role } from '@prisma/client';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { createUser, loginAs } from '../helpers/factories';
import { RoleProbeController } from '../helpers/role-probe.controller';

const ENDPOINT_BY_ROLE: Record<Role, string> = {
  ADMIN: '/api/pruebas/roles/admin',
  WAITER: '/api/pruebas/roles/mozo',
  KITCHEN: '/api/pruebas/roles/cocina',
  CASHIER: '/api/pruebas/roles/caja',
};
const NON_ADMIN_ROLES: Role[] = ['WAITER', 'KITCHEN', 'CASHIER'];
const FORBIDDEN = { code: 'FORBIDDEN', message: 'No tienes permiso para realizar esta acción' };

describe('US2 — Acceso por rol en el backend', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp([RoleProbeController]);
    prisma = prismaOf(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    RoleProbeController.writes = 0;
  });

  it('[001] AC-2.3: mozo, cocina y cajero no pueden usar operaciones de otros roles y no cambian ningún dato', async () => {
    for (const role of NON_ADMIN_ROLES) {
      const agent = await loginAs(app, await createUser(prisma, { role }));
      for (const [target, endpoint] of Object.entries(ENDPOINT_BY_ROLE) as Array<[Role, string]>) {
        if (target === role) {
          await agent.get(endpoint).expect(200);
          continue;
        }
        const read = await agent.get(endpoint).expect(403);
        expect(read.body).toEqual(FORBIDDEN);
        const write = await agent.post(endpoint).expect(403);
        expect(write.body).toEqual(FORBIDDEN);
      }
    }
    expect(RoleProbeController.writes).toBe(0);
  });

  it('[001] AC-2.4: el cambio de rol se aplica en la siguiente acción sin volver a iniciar sesión', async () => {
    const user = await createUser(prisma, { role: 'WAITER' });
    const agent = await loginAs(app, user);
    await agent.get(ENDPOINT_BY_ROLE.CASHIER).expect(403);

    await prisma.user.update({ where: { id: user.id }, data: { role: 'CASHIER' } });

    await agent.get(ENDPOINT_BY_ROLE.CASHIER).expect(200);
    await agent.get(ENDPOINT_BY_ROLE.WAITER).expect(403);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ role: 'CASHIER', homePath: '/caja' });
  });

  it('[001] AC-2.4: un administrador que pasa a mozo pierde el acceso de administrador en su siguiente acción', async () => {
    const admin = await createUser(prisma, { role: 'ADMIN' });
    const agent = await loginAs(app, admin);
    await agent.get(ENDPOINT_BY_ROLE.ADMIN).expect(200);

    await prisma.user.update({ where: { id: admin.id }, data: { role: 'WAITER' } });

    await agent.get(ENDPOINT_BY_ROLE.ADMIN).expect(403);
  });

  it('[001] AC-2.5: el administrador puede usar las operaciones de todos los roles', async () => {
    const agent = await loginAs(app, await createUser(prisma, { role: 'ADMIN' }));
    for (const endpoint of Object.values(ENDPOINT_BY_ROLE)) {
      await agent.get(endpoint).expect(200);
      await agent.post(endpoint).expect(201);
    }
    expect(RoleProbeController.writes).toBe(4);
  });
});
