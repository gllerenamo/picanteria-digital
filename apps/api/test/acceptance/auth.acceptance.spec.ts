import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Role } from '@prisma/client';
import request from 'supertest';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { CSRF, createUser, loginAs } from '../helpers/factories';

const INVALID_CREDENTIALS = { code: 'INVALID_CREDENTIALS', message: 'Usuario o contraseña incorrectos' };

describe('US1 — Inicio y cierre de sesión', () => {
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

  const login = (body: object) => request(app.getHttpServer()).post('/api/auth/login').set(CSRF).send(body);

  it('[001] AC-1.1: un mozo activo ingresa, recibe la cookie de sesión y su pantalla inicial', async () => {
    const mozo = await createUser(prisma, { role: 'WAITER', username: 'mozo1', fullName: 'Juan Mamani' });

    const response = await login({ username: 'mozo1', password: mozo.password }).expect(200);

    expect(response.body).toEqual({
      id: mozo.id,
      fullName: 'Juan Mamani',
      username: 'mozo1',
      role: 'WAITER',
      homePath: '/mozo',
    });
    const cookie = response.get('Set-Cookie')?.[0] ?? '';
    expect(cookie).toMatch(/^sid=[\w-]{20,};/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Max-Age=43200');
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Secure');
  });

  it('[001] AC-1.2: cada rol recibe la pantalla inicial que le corresponde', async () => {
    const expected: Record<Role, string> = {
      ADMIN: '/admin/usuarios',
      WAITER: '/mozo',
      KITCHEN: '/cocina',
      CASHIER: '/caja',
    };
    for (const [role, homePath] of Object.entries(expected) as Array<[Role, string]>) {
      const user = await createUser(prisma, { role });
      const response = await login({ username: user.username, password: user.password }).expect(200);
      expect(response.body).toMatchObject({ role, homePath });
    }
  });

  it('[001] AC-1.3: contraseña incorrecta y usuario inexistente reciben el mismo mensaje genérico', async () => {
    const mozo = await createUser(prisma, { username: 'mozo1' });

    const wrongPassword = await login({ username: 'mozo1', password: 'no-es-la-clave' }).expect(401);
    const unknownUser = await login({ username: 'nadie', password: mozo.password }).expect(401);

    expect(wrongPassword.body).toEqual(INVALID_CREDENTIALS);
    expect(unknownUser.body).toEqual(INVALID_CREDENTIALS);
    expect(wrongPassword.get('Set-Cookie')).toBeUndefined();
  });

  it('[001] AC-1.4: un usuario desactivado no ingresa y se le indica que consulte al administrador', async () => {
    const user = await createUser(prisma, { username: 'inactivo', isActive: false });

    const correct = await login({ username: 'inactivo', password: user.password }).expect(401);
    expect(correct.body).toEqual({
      code: 'ACCOUNT_DISABLED',
      message: 'Tu cuenta está desactivada. Consulta al administrador.',
    });

    // Sin la contraseña correcta no se revela que la cuenta existe y está desactivada.
    const wrong = await login({ username: 'inactivo', password: 'no-es-la-clave' }).expect(401);
    expect(wrong.body).toEqual(INVALID_CREDENTIALS);
  });

  it('[001] AC-1.5: cerrar sesión revoca la sesión y borra la cookie', async () => {
    const user = await createUser(prisma);
    const response = await login({ username: user.username, password: user.password }).expect(200);
    const sessionCookie = (response.get('Set-Cookie')?.[0] ?? '').split(';')[0] ?? '';

    const logout = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set(CSRF)
      .set('Cookie', sessionCookie)
      .expect(204);
    expect(logout.get('Set-Cookie')?.[0]).toMatch(/^sid=;/);

    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', sessionCookie).expect(401);
    expect(me.body).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('[001] AC-1.6: tras 5 intentos fallidos la cuenta se bloquea 15 minutos aunque la contraseña sea correcta', async () => {
    const user = await createUser(prisma, { username: 'cocina1', role: 'KITCHEN' });
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await login({ username: 'cocina1', password: `incorrecta-${attempt}` }).expect(401);
      expect(response.body).toEqual(INVALID_CREDENTIALS);
    }

    const before = Date.now();
    const locked = await login({ username: 'cocina1', password: user.password }).expect(423);
    expect(locked.body).toMatchObject({
      code: 'ACCOUNT_LOCKED',
      message: 'Cuenta bloqueada por intentos fallidos. Inténtalo de nuevo en 15 minutos.',
    });
    const lockedUntil = new Date((locked.body as { details: { lockedUntil: string } }).details.lockedUntil).getTime();
    expect(lockedUntil - before).toBeGreaterThan(14 * 60 * 1000);
    expect(lockedUntil - before).toBeLessThanOrEqual(15 * 60 * 1000);

    // Los intentos durante el bloqueo no lo alargan.
    await login({ username: 'cocina1', password: 'otra-incorrecta' }).expect(423);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.lockedUntil?.getTime()).toBe(lockedUntil);

    // Al vencer el bloqueo puede ingresar y el contador se reinicia.
    await prisma.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    await login({ username: 'cocina1', password: user.password }).expect(200);
    const reset = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(reset.failedLoginAttempts).toBe(0);
    expect(reset.lockedUntil).toBeNull();
  });

  it('[001] AC-1.7: sin sesión no se puede consultar ninguna información interna', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    expect(response.body).toEqual({ code: 'UNAUTHENTICATED', message: 'Tu sesión terminó. Vuelve a iniciar sesión.' });
  });

  it('el contador de fallos se reinicia cuando vence un bloqueo anterior', async () => {
    const user = await createUser(prisma, { failedLoginAttempts: 5, lockedUntil: new Date(Date.now() - 1000) });
    await login({ username: user.username, password: 'incorrecta' }).expect(401);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.failedLoginAttempts).toBe(1);
    expect(stored.lockedUntil).toBeNull();
  });

  it('FR-007: una sesión con más de 12 horas ya no es válida', async () => {
    const user = await createUser(prisma);
    const agent = await loginAs(app, user);
    await prisma.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await agent.get('/api/auth/me').expect(401);
  });

  it('GET /auth/me devuelve el usuario de la sesión', async () => {
    const user = await createUser(prisma, { role: 'CASHIER', fullName: 'Rosa Flores' });
    const agent = await loginAs(app, user);
    const response = await agent.get('/api/auth/me').expect(200);
    expect(response.body).toEqual({
      id: user.id,
      fullName: 'Rosa Flores',
      username: user.username,
      role: 'CASHIER',
      homePath: '/caja',
    });
  });

  it('el nombre de usuario se compara sin espacios en los extremos y sin distinguir mayúsculas', async () => {
    const user = await createUser(prisma, { username: 'mozo1' });
    await login({ username: '  Mozo1 ', password: user.password }).expect(200);
  });

  it('valida los datos de ingreso con mensajes en español', async () => {
    const response = await login({ username: 'mozo1' }).expect(400);
    expect(response.body).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Revisa los datos ingresados',
      details: { password: 'Ingresa tu contraseña' },
    });
  });

  it('rechaza las peticiones que modifican datos sin la cabecera CSRF', async () => {
    const user = await createUser(prisma);
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: user.username, password: user.password })
      .expect(403);
    expect(response.body).toMatchObject({ code: 'CSRF_HEADER_MISSING' });
  });
});
