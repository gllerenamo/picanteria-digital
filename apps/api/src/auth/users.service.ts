import { HttpStatus, Injectable } from '@nestjs/common';
import type { CreateUserRequest, UpdateUserRequest, User as UserDto } from '@picanteria/shared';
import { Prisma } from '@prisma/client';
import { AppException } from '../common/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';

const USER_SELECT = {
  id: true,
  fullName: true,
  username: true,
  role: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type UserRecord = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;
type Tx = Prisma.TransactionClient;

function toDto(user: UserRecord): UserDto {
  return { ...user, createdAt: user.createdAt.toISOString() };
}

function userNotFound(): AppException {
  return new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'El usuario no existe' });
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany({ select: USER_SELECT, orderBy: { fullName: 'asc' } });
    return users.map(toDto);
  }

  async create(input: CreateUserRequest): Promise<UserDto> {
    try {
      const user = await this.prisma.user.create({
        data: {
          fullName: input.fullName,
          username: input.username,
          passwordHash: await this.passwords.hash(input.password),
          role: input.role,
        },
        select: USER_SELECT,
      });
      return toDto(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException('USERNAME_TAKEN', HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateUserRequest): Promise<UserDto> {
    const { before, after } = await this.serializable(async (tx) => {
      const current = await this.findOrThrow(tx, id);
      if (input.role !== undefined && input.role !== 'ADMIN' && current.role === 'ADMIN' && current.isActive) {
        await this.assertAnotherActiveAdmin(tx, id);
      }
      const updated = await tx.user.update({
        where: { id },
        data: { fullName: input.fullName, role: input.role },
        select: USER_SELECT,
      });
      return { before: current, after: updated };
    });

    const fields: Array<'fullName' | 'role'> = [];
    if (before.fullName !== after.fullName) fields.push('fullName');
    if (before.role !== after.role) fields.push('role');
    if (fields.length > 0) this.realtime.profileChanged(id, { fields });
    return toDto(after);
  }

  async setPassword(id: string, password: string): Promise<void> {
    const passwordHash = await this.passwords.hash(password);
    await this.serializable(async (tx) => {
      await this.findOrThrow(tx, id);
      await tx.user.update({ where: { id }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } });
    });
  }

  async setStatus(actorId: string, id: string, isActive: boolean): Promise<UserDto> {
    if (!isActive && actorId === id) throw new AppException('CANNOT_DISABLE_SELF', HttpStatus.CONFLICT);

    const { wasActive, updated } = await this.serializable(async (tx) => {
      const current = await this.findOrThrow(tx, id);
      if (!isActive && current.role === 'ADMIN' && current.isActive) {
        await this.assertAnotherActiveAdmin(tx, id);
      }
      const result = await tx.user.update({ where: { id }, data: { isActive }, select: USER_SELECT });
      return { wasActive: current.isActive, updated: result };
    });

    if (wasActive && !isActive) {
      await this.sessions.revokeAllForUser(id);
      this.realtime.userDisabled(id);
    }
    return toDto(updated);
  }

  private async findOrThrow(tx: Tx, id: string): Promise<UserRecord> {
    const user = await tx.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw userNotFound();
    return user;
  }

  /** Siempre debe quedar al menos un administrador activo (FR-019). */
  private async assertAnotherActiveAdmin(tx: Tx, excludedId: string): Promise<void> {
    const others = await tx.user.count({ where: { role: 'ADMIN', isActive: true, id: { not: excludedId } } });
    if (others === 0) throw new AppException('LAST_ADMIN', HttpStatus.CONFLICT);
  }

  /**
   * Transacción serializable: evita que dos administradores se desactiven a la vez y dejen el
   * sistema sin ninguno (research.md §9). Ante un conflicto de serialización se reintenta.
   */
  private async serializable<T>(work: (tx: Tx) => Promise<T>, retries = 2): Promise<T> {
    try {
      return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (retries > 0 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return this.serializable(work, retries - 1);
      }
      throw error;
    }
  }
}
