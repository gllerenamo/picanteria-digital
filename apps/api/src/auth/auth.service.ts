import { HttpStatus, Injectable } from '@nestjs/common';
import { ROLE_HOME, type CurrentUser, type LoginRequest } from '@picanteria/shared';
import { AppException } from '../common/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { AuthenticatedUser } from './auth.types';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';

/** Intentos fallidos consecutivos que bloquean la cuenta (FR-003). */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

export function toCurrentUser(user: AuthenticatedUser): CurrentUser {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
    homePath: ROLE_HOME[user.role],
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Orden de comprobación de research.md §7. */
  async login(input: LoginRequest, userAgent?: string): Promise<{ token: string; user: CurrentUser }> {
    const username = input.username.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      await this.passwords.verifyAgainstDummy(input.password);
      throw new AppException('INVALID_CREDENTIALS', HttpStatus.UNAUTHORIZED);
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      throw new AppException('ACCOUNT_LOCKED', HttpStatus.LOCKED, {
        details: { lockedUntil: user.lockedUntil.toISOString() },
      });
    }

    if (!(await this.passwords.verify(user.passwordHash, input.password))) {
      // Si un bloqueo anterior ya venció, el contador empieza de nuevo.
      const attempts = (user.lockedUntil ? 0 : user.failedLoginAttempts) + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCK_DURATION_MS) : null,
        },
      });
      throw new AppException('INVALID_CREDENTIALS', HttpStatus.UNAUTHORIZED);
    }

    if (!user.isActive) throw new AppException('ACCOUNT_DISABLED', HttpStatus.UNAUTHORIZED);

    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    const { token } = await this.sessions.create(user.id, userAgent);
    return { token, user: toCurrentUser(user) };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId);
    this.realtime.sessionClosed(sessionId);
  }
}
