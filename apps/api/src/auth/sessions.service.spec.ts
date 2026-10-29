import type { PrismaService } from '../prisma/prisma.service';
import { SESSION_TTL_MS, SessionsService, hashToken } from './sessions.service';

interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
}

function setup(user = { id: 'u1', fullName: 'Ana Quispe', username: 'ana', role: 'WAITER', isActive: true }) {
  const sessions: StoredSession[] = [];
  const prisma = {
    session: {
      create: jest.fn(({ data }: { data: Omit<StoredSession, 'id' | 'revokedAt'> }) => {
        const session = { ...data, id: `s${sessions.length + 1}`, revokedAt: null };
        sessions.push(session);
        return Promise.resolve(session);
      }),
      findUnique: jest.fn(({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.find((s) => s.tokenHash === where.tokenHash);
        return Promise.resolve(session ? { ...session, user } : null);
      }),
    },
  };
  return { service: new SessionsService(prisma as unknown as PrismaService), sessions };
}

describe('SessionsService', () => {
  it('guarda solo el hash SHA-256 del token y expira a las 12 horas', async () => {
    const { service, sessions } = setup();
    const { token, expiresAt } = await service.create('u1', 'Tablet');
    const stored = sessions[0]!;
    expect(stored.tokenHash).toBe(hashToken(token));
    expect(stored.tokenHash).not.toContain(token);
    expect(stored.tokenHash).toHaveLength(64);
    expect(expiresAt.getTime() - stored.createdAt.getTime()).toBe(SESSION_TTL_MS);
  });

  it('valida una sesión vigente y devuelve el usuario con su rol actual', async () => {
    const { service } = setup();
    const { token, sessionId } = await service.create('u1');
    await expect(service.validate(token)).resolves.toEqual({
      sessionId,
      user: { id: 'u1', fullName: 'Ana Quispe', username: 'ana', role: 'WAITER' },
    });
  });

  it('rechaza un token inexistente o vacío', async () => {
    const { service } = setup();
    await expect(service.validate('token-desconocido')).resolves.toBeNull();
    await expect(service.validate(undefined)).resolves.toBeNull();
  });

  it('rechaza sesiones revocadas o expiradas', async () => {
    const { service, sessions } = setup();
    const revoked = await service.create('u1');
    sessions[0]!.revokedAt = new Date();
    const expired = await service.create('u1');
    sessions[1]!.expiresAt = new Date(Date.now() - 1000);
    await expect(service.validate(revoked.token)).resolves.toBeNull();
    await expect(service.validate(expired.token)).resolves.toBeNull();
  });

  it('rechaza la sesión de un usuario desactivado', async () => {
    const { service } = setup({ id: 'u1', fullName: 'Ana', username: 'ana', role: 'WAITER', isActive: false });
    const { token } = await service.create('u1');
    await expect(service.validate(token)).resolves.toBeNull();
  });
});
