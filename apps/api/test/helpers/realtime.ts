import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ServerToClientEvents } from '@picanteria/shared';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { CSRF } from './factories';

/** Ayudantes de las pruebas de tiempo real (patrón de realtime.acceptance.spec.ts de la 001). */

type TestSocket = Socket<ServerToClientEvents, Record<string, never>>;

/** Arranca la aplicación en un puerto libre y devuelve su URL. */
export async function listen(app: NestExpressApplication): Promise<string> {
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

/** Inicia sesión y devuelve la cookie `sid=…` para el socket o para supertest. */
export async function sessionCookie(url: string, user: { username: string; password: string }): Promise<string> {
  const response = await request(url)
    .post('/api/auth/login')
    .set(CSRF)
    .send({ username: user.username, password: user.password })
    .expect(200);
  return (response.get('Set-Cookie')?.[0] ?? '').split(';')[0] ?? '';
}

/** Abre un socket autenticado con la sesión del usuario; `sockets` acumula los abiertos para cerrarlos. */
export async function connectAs(
  url: string,
  user: { username: string; password: string },
  sockets: TestSocket[],
): Promise<TestSocket> {
  const cookie = await sessionCookie(url, user);
  const socket: TestSocket = io(url, {
    transports: ['websocket'],
    extraHeaders: { Cookie: cookie },
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

/** Espera un evento; falla si no llega en `ms` (por defecto 3 s, SC-003 y SC-004). */
export function nextEvent<E extends keyof ServerToClientEvents>(
  socket: TestSocket,
  event: E,
  ms = 3000,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`No llegó ${event} en ${ms} ms`));
    }, ms);
    const listener = (payload: Parameters<ServerToClientEvents[E]>[0]): void => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, listener as never);
  });
}

/** Comprueba que un evento no llega en `ms`. */
export async function expectNoEvent(socket: TestSocket, event: keyof ServerToClientEvents, ms = 500): Promise<void> {
  const received: unknown[] = [];
  const listener = (payload: unknown): void => {
    received.push(payload);
  };
  socket.on(event, listener);
  await new Promise((resolve) => setTimeout(resolve, ms));
  socket.off(event, listener);
  if (received.length > 0) throw new Error(`Llegó ${event} y no debía`);
}
