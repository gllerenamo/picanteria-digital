import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Role, User } from '@prisma/client';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { CSRF, createUser, loginAs } from '../helpers/factories';

const UUID = /^[0-9a-f-]{36}$/;

describe('US3 — Gestión de usuarios por el administrador', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: User & { password: string };
  let adminAgent: TestAgent;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = prismaOf(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    admin = await createUser(prisma, { role: 'ADMIN', username: 'admin', fullName: 'Administradora' });
    adminAgent = await loginAs(app, admin);
  });

  const login = (username: string, password: string) =>
    request(app.getHttpServer()).post('/api/auth/login').set(CSRF).send({ username, password });

  it('[001] AC-3.1: el administrador registra un usuario activo que puede iniciar sesión', async () => {
    const response = await adminAgent
      .post('/api/users')
      .send({ fullName: '  María Condori ', username: ' Maria.C ', password: 'clave-mesa-123', role: 'WAITER' })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.stringMatching(UUID) as unknown,
      fullName: 'María Condori',
      username: 'maria.c',
      role: 'WAITER',
      isActive: true,
      createdAt: expect.any(String) as unknown,
    });
    await login('maria.c', 'clave-mesa-123').expect(200);
  });

  it('[001] AC-3.2: no se puede repetir un nombre de usuario aunque cambien las mayúsculas', async () => {
    await createUser(prisma, { username: 'mozo1' });
    const response = await adminAgent
      .post('/api/users')
      .send({ fullName: 'Otro Mozo', username: 'Mozo1', password: 'clave-mesa-123', role: 'WAITER' })
      .expect(409);
    expect(response.body).toEqual({ code: 'USERNAME_TAKEN', message: 'El nombre de usuario ya existe' });
  });

  it('[001] AC-3.3: una contraseña de menos de 8 caracteres se rechaza indicando la longitud mínima', async () => {
    const response = await adminAgent
      .post('/api/users')
      .send({ fullName: 'Pedro Quispe', username: 'pedro', password: 'corta12', role: 'KITCHEN' })
      .expect(400);
    expect(response.body).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Revisa los datos ingresados',
      details: { password: 'La contraseña debe tener al menos 8 caracteres' },
    });
    expect(await prisma.user.count({ where: { username: 'pedro' } })).toBe(0);
  });

  it('[001] AC-3.4: el administrador cambia el nombre completo y el rol de un usuario', async () => {
    const user = await createUser(prisma, { role: 'WAITER', fullName: 'Luis Ccama' });

    const response = await adminAgent
      .patch(`/api/users/${user.id}`)
      .send({ fullName: 'Luis Ccama Huamán', role: 'CASHIER' })
      .expect(200);
    expect(response.body).toMatchObject({ id: user.id, fullName: 'Luis Ccama Huamán', role: 'CASHIER' });

    const list = await adminAgent.get('/api/users').expect(200);
    expect(list.body).toContainEqual(expect.objectContaining({ id: user.id, fullName: 'Luis Ccama Huamán', role: 'CASHIER' }));
  });

  it('[001] AC-3.5: con la contraseña nueva puede ingresar y con la anterior ya no', async () => {
    const user = await createUser(prisma, { failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 10 * 60 * 1000) });

    await adminAgent.put(`/api/users/${user.id}/password`).send({ password: 'clave-nueva-456' }).expect(204);

    await login(user.username, 'clave-nueva-456').expect(200);
    await login(user.username, user.password).expect(401);
  });

  it('[001] AC-3.6: un usuario desactivado no puede ingresar, pierde su sesión y sigue en la lista como inactivo', async () => {
    const user = await createUser(prisma, { role: 'KITCHEN' });
    const userAgent = await loginAs(app, user);

    const response = await adminAgent.patch(`/api/users/${user.id}/status`).send({ isActive: false }).expect(200);
    expect(response.body).toMatchObject({ id: user.id, isActive: false });

    await userAgent.get('/api/auth/me').expect(401);
    const retry = await login(user.username, user.password).expect(401);
    expect(retry.body).toMatchObject({ code: 'ACCOUNT_DISABLED' });
    const list = await adminAgent.get('/api/users').expect(200);
    expect(list.body).toContainEqual(expect.objectContaining({ id: user.id, isActive: false }));
  });

  it('[001] AC-3.7: un usuario reactivado vuelve a ingresar con su contraseña', async () => {
    const user = await createUser(prisma, { isActive: false });
    await adminAgent.patch(`/api/users/${user.id}/status`).send({ isActive: true }).expect(200);
    await login(user.username, user.password).expect(200);
  });

  it('[001] AC-3.8: siempre queda al menos un administrador activo', async () => {
    const ownRole = await adminAgent.patch(`/api/users/${admin.id}`).send({ role: 'WAITER' }).expect(409);
    expect(ownRole.body).toEqual({ code: 'LAST_ADMIN', message: 'Debe existir al menos un administrador activo' });

    const ownStatus = await adminAgent.patch(`/api/users/${admin.id}/status`).send({ isActive: false }).expect(409);
    expect(ownStatus.body).toEqual({ code: 'CANNOT_DISABLE_SELF', message: 'No puedes desactivar tu propia cuenta' });

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(stored).toMatchObject({ role: 'ADMIN', isActive: true });
  });

  it('[001] AC-3.8: dos administradores que se desactivan a la vez dejan uno activo', async () => {
    const second = await createUser(prisma, { role: 'ADMIN', username: 'admin2' });
    const secondAgent = await loginAs(app, second);

    const responses = await Promise.all([
      adminAgent.patch(`/api/users/${second.id}/status`).send({ isActive: false }),
      secondAgent.patch(`/api/users/${admin.id}/status`).send({ isActive: false }),
    ]);

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses[0]).toBe(200);
    // La otra petición se rechaza: por ser el último administrador o porque su sesión ya fue revocada.
    expect([401, 409]).toContain(statuses[1]);
    expect(await prisma.user.count({ where: { role: 'ADMIN', isActive: true } })).toBe(1);
  });

  it('[001] AC-3.9: la lista muestra nombre, usuario, rol y estado, y nunca contraseñas', async () => {
    await createUser(prisma, { role: 'CASHIER', fullName: 'Rosa Flores', username: 'rosa' });

    const list = await adminAgent.get('/api/users').expect(200);
    const body = list.body as Array<Record<string, unknown>>;
    expect(body.map((user) => user.fullName)).toEqual(['Administradora', 'Rosa Flores']);
    expect(body[1]).toEqual({
      id: expect.stringMatching(UUID) as unknown,
      fullName: 'Rosa Flores',
      username: 'rosa',
      role: 'CASHIER',
      isActive: true,
      createdAt: expect.any(String) as unknown,
    });
    expect(JSON.stringify(list.body)).not.toMatch(/password/i);
  });

  it('responde NOT_FOUND para un usuario inexistente o un ID inválido', async () => {
    const missing = await adminAgent
      .patch('/api/users/4f1c2b8e-1d2a-4c3b-9e4f-1a2b3c4d5e6f')
      .send({ fullName: 'Nadie Nunca' })
      .expect(404);
    expect(missing.body).toEqual({ code: 'NOT_FOUND', message: 'El usuario no existe' });
    await adminAgent.put('/api/users/no-es-un-id/password').send({ password: 'clave-nueva-456' }).expect(404);
  });

  it('mozo, cocina y cajero no pueden usar la gestión de usuarios', async () => {
    for (const role of ['WAITER', 'KITCHEN', 'CASHIER'] as Role[]) {
      const agent = await loginAs(app, await createUser(prisma, { role }));
      await agent.get('/api/users').expect(403);
      await agent
        .post('/api/users')
        .send({ fullName: 'Intruso', username: 'intruso', password: 'clave-mesa-123', role: 'ADMIN' })
        .expect(403);
    }
    expect(await prisma.user.count({ where: { username: 'intruso' } })).toBe(0);
  });

  it('valida el nombre de usuario y la edición con mensajes en español', async () => {
    const invalid = await adminAgent
      .post('/api/users')
      .send({ fullName: 'Ana', username: 'ana maría', password: 'clave-mesa-123', role: 'WAITER' })
      .expect(400);
    expect(invalid.body).toMatchObject({
      details: { username: 'El usuario debe tener de 3 a 30 caracteres: letras sin tildes, números, punto, guion o guion bajo' },
    });

    const user = await createUser(prisma);
    const empty = await adminAgent.patch(`/api/users/${user.id}`).send({}).expect(400);
    expect(empty.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
