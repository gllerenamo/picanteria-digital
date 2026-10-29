import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionContext } from './auth.types';

export const SESSION_COOKIE = 'sid';
/** Las sesiones expiran 12 horas después de iniciadas (FR-007). */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea una sesión y devuelve el token en claro, que solo viaja en la cookie. */
  async create(userId: string, userAgent?: string): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_MS);
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        createdAt,
        expiresAt,
        userAgent: userAgent?.slice(0, 255) ?? null,
      },
    });
    return { token, sessionId: session.id, expiresAt };
  }

  /** Devuelve la sesión solo si está vigente y su usuario está activo. */
  async validate(token: string | undefined): Promise<SessionContext | null> {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
      return null;
    }
    const { id, fullName, username, role } = session.user;
    return { sessionId: session.id, user: { id, fullName, username, role } };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoca todas las sesiones vigentes de un usuario y devuelve sus ID. */
  async revokeAllForUser(userId: string): Promise<string[]> {
    const now = new Date();
    const active = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      select: { id: true },
    });
    const ids = active.map((session) => session.id);
    if (ids.length > 0) {
      await this.prisma.session.updateMany({ where: { id: { in: ids } }, data: { revokedAt: now } });
    }
    return ids;
  }
}
