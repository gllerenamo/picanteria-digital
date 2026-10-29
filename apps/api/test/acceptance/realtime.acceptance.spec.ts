import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { CSRF, createUser } from '../helpers/factories';

describe('US3 — Avisos en tiempo real', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = prismaOf(app);
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  async function sessionCookie(user: User & { password: string }): Promise<string> {
    const response = await request(url)
      .post('/api/auth/login')
      .set(CSRF)
      .send({ username: user.username, password: user.password })
      .expect(200);
    return (response.get('Set-Cookie')?.[0] ?? '').split(';')[0] ?? '';
  }

  function connect(cookie?: string): Promise<Socket> {
    const socket = io(url, {
      transports: ['websocket'],
      extraHeaders: cookie ? { Cookie: cookie } : {},
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => {
        resolve(socket);
      });
      socket.once('connect_error', reject);
    });
  }

  function nextEvent<T>(socket: Socket, event: string): Promise<T> {
    return new Promise((resolve) => socket.once(event, resolve));
  }

  const asAdmin = async () => {
    const admin = await createUser(prisma, { role: 'ADMIN' });
    return request.agent(url).set(CSRF).set('Cookie', await sessionCookie(admin));
  };

  it('rechaza la conexión sin una sesión válida', async () => {
    await expect(connect()).rejects.toThrow('UNAUTHENTICATED');
    await expect(connect('sid=token-falso')).rejects.toThrow('UNAUTHENTICATED');
  });

  it('[001] AC-3.6: al desactivar a un usuario, su sesión abierta recibe el aviso y se desconecta', async () => {
    const user = await createUser(prisma, { role: 'WAITER' });
    const socket = await connect(await sessionCookie(user));
    const revoked = nextEvent<{ reason: string }>(socket, 'auth:session-revoked');
    const disconnected = nextEvent<string>(socket, 'disconnect');

    const admin = await asAdmin();
    await admin.patch(`/api/users/${user.id}/status`).send({ isActive: false }).expect(200);

    await expect(revoked).resolves.toEqual({ reason: 'USER_DISABLED' });
    await expect(disconnected).resolves.toBeDefined();
  });

  it('[001] AC-2.4: al cambiar el rol, la sesión abierta recibe el aviso para redibujar el menú', async () => {
    const user = await createUser(prisma, { role: 'WAITER' });
    const socket = await connect(await sessionCookie(user));
    const changed = nextEvent<{ fields: string[] }>(socket, 'auth:profile-changed');

    const admin = await asAdmin();
    await admin.patch(`/api/users/${user.id}`).send({ role: 'CASHIER' }).expect(200);

    await expect(changed).resolves.toEqual({ fields: ['role'] });
  });

  it('al cerrar sesión solo se avisa a los sockets de esa sesión', async () => {
    const user = await createUser(prisma);
    const closedCookie = await sessionCookie(user);
    const closedSocket = await connect(closedCookie);
    const otherSocket = await connect(await sessionCookie(user));
    let otherNotified = false;
    otherSocket.on('auth:session-revoked', () => {
      otherNotified = true;
    });
    const revoked = nextEvent<{ reason: string }>(closedSocket, 'auth:session-revoked');

    await request(url).post('/api/auth/logout').set(CSRF).set('Cookie', closedCookie).expect(204);

    await expect(revoked).resolves.toEqual({ reason: 'LOGGED_OUT' });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(otherNotified).toBe(false);
    expect(otherSocket.connected).toBe(true);
  });
});
