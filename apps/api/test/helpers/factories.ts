import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Role, User } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';

export const CSRF = { 'X-Requested-With': 'picanteria-web' } as const;
export const DEFAULT_PASSWORD = 'clave-segura-123';

let counter = 0;

interface UserOverrides {
  role?: Role;
  username?: string;
  fullName?: string;
  password?: string;
  isActive?: boolean;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
}

export async function createUser(prisma: PrismaService, overrides: UserOverrides = {}): Promise<User & { password: string }> {
  counter += 1;
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const user = await prisma.user.create({
    data: {
      fullName: overrides.fullName ?? `Usuario ${counter}`,
      username: overrides.username ?? `usuario${counter}`,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: overrides.role ?? 'WAITER',
      isActive: overrides.isActive ?? true,
      failedLoginAttempts: overrides.failedLoginAttempts ?? 0,
      lockedUntil: overrides.lockedUntil ?? null,
    },
  });
  return { ...user, password };
}

/** Inicia sesión y devuelve un agente que conserva la cookie y envía la cabecera CSRF. */
export async function loginAs(
  app: NestExpressApplication,
  credentials: { username: string; password: string },
): Promise<TestAgent> {
  const agent = request.agent(app.getHttpServer()).set(CSRF);
  await agent
    .post('/api/auth/login')
    .send({ username: credentials.username, password: credentials.password })
    .expect(200);
  return agent;
}
