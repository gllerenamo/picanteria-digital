import { HttpStatus, Injectable } from '@nestjs/common';
import type { ReadyNotice } from '@picanteria/shared';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AppException } from '../common/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NOTICE_NOT_FOUND } from './params';

const NOTICE_INCLUDE = {
  orderItem: {
    select: {
      menuItem: { select: { name: true } },
      order: { select: { table: { select: { tableNumber: true } } } },
    },
  },
} satisfies Prisma.ReadyNoticeInclude;

type NoticeRecord = Prisma.ReadyNoticeGetPayload<{ include: typeof NOTICE_INCLUDE }>;

export function toReadyNotice(record: NoticeRecord): ReadyNotice {
  return {
    id: record.id,
    orderItemId: record.orderItemId,
    tableNumber: record.orderItem.order.table.tableNumber,
    itemName: record.orderItem.menuItem.name,
    quantity: record.quantity,
    createdAt: record.createdAt.toISOString(),
  };
}

/** Avisos de plato listo del mozo responsable (FR-015 a FR-017). */
@Injectable()
export class ReadyNoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Avisos abiertos del usuario, del más antiguo al más reciente (AC-3.3). */
  async listOpen(userId: string): Promise<ReadyNotice[]> {
    const records = await this.prisma.readyNotice.findMany({
      where: { recipientId: userId, seenAt: null, withdrawnAt: null },
      include: NOTICE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toReadyNotice);
  }

  /** "Visto": solo el destinatario; repetirlo no falla (AC-3.2, AC-3.5). */
  async markSeen(noticeId: string, user: AuthenticatedUser): Promise<void> {
    const notice = await this.prisma.readyNotice.findUnique({ where: { id: noticeId } });
    if (!notice) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: NOTICE_NOT_FOUND });
    if (notice.recipientId !== user.id) {
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN, { message: 'Este aviso es para otro mozo' });
    }
    const closed = await this.prisma.readyNotice.updateMany({
      where: { id: noticeId, seenAt: null, withdrawnAt: null },
      data: { seenAt: new Date() },
    });
    if (closed.count > 0) {
      this.realtime.emitToUser(notice.recipientId, 'kitchen:ready-notice-closed', { id: noticeId, reason: 'SEEN' });
    }
  }
}
