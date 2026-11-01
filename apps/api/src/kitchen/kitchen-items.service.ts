import { HttpStatus, Injectable } from '@nestjs/common';
import type { TicketItem } from '@picanteria/shared';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AppException } from '../common/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { KitchenBoardService } from './kitchen-board.service';
import { nextStatus, previousStatus, withinCompletedWindow, type StepFrom, type UndoFrom } from './kitchen-rules';
import { ITEM_NOT_FOUND } from './params';
import { toReadyNotice } from './ready-notices.service';

type Tx = Prisma.TransactionClient;
type KitchenStatus = 'PENDING' | 'PREPARING' | 'READY';

const SENT_ITEM_INCLUDE = {
  menuItem: { select: { name: true } },
  order: { select: { waiterId: true, table: { select: { tableNumber: true } } } },
} satisfies Prisma.OrderItemInclude;

type SentItem = Prisma.OrderItemGetPayload<{ include: typeof SENT_ITEM_INCLUDE }> & { dispatchId: string };

/**
 * Pasos de cocina y "Deshacer" (FR-008 a FR-011, FR-015, FR-018). Cada cambio es una
 * actualización condicionada por el estado que vio la pantalla (research.md §2), en la misma
 * transacción que su historial y el aviso al mozo; los eventos salen después del commit.
 */
@Injectable()
export class KitchenItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly board: KitchenBoardService,
  ) {}

  async advance(itemId: string, from: StepFrom, user: AuthenticatedUser): Promise<TicketItem> {
    const to = nextStatus(from);
    const { item, changedAt, notice } = await this.prisma.$transaction(async (tx) => {
      const found = await findSentItem(tx, itemId);
      const updated = await tx.orderItem.updateMany({ where: { id: itemId, status: from }, data: { status: to } });
      if (updated.count === 0) throw await stateConflict(tx, itemId);
      const change = await tx.orderItemStatusChange.create({
        data: { orderItemId: itemId, fromStatus: from, toStatus: to, changedById: user.id },
      });

      // Al quedar listo, el aviso va al mozo responsable de la mesa (FR-015, AC-3.5).
      let created = null;
      if (to === 'READY') {
        const fresh = await tx.orderItem.findUniqueOrThrow({ where: { id: itemId }, select: { quantity: true, voidedQuantity: true } });
        created = await tx.readyNotice.create({
          data: { orderItemId: itemId, recipientId: found.order.waiterId, quantity: fresh.quantity - fresh.voidedQuantity },
        });
      }
      return { item: found, changedAt: change.changedAt, notice: created };
    });

    this.emitStatusChanged(item, from, to, false, changedAt);
    if (notice) {
      this.realtime.emitToUser(
        notice.recipientId,
        'kitchen:ready-notice',
        toReadyNotice({ ...notice, orderItem: { menuItem: item.menuItem, order: item.order } }),
      );
    }
    return this.board.ticketItem(item.dispatchId, itemId, new Date());
  }

  async undo(itemId: string, from: UndoFrom, user: AuthenticatedUser): Promise<TicketItem> {
    const to = previousStatus(from);
    const now = new Date();
    const { item, changedAt, withdrawn } = await this.prisma.$transaction(async (tx) => {
      const found = await findSentItem(tx, itemId);
      if (found.status === 'VOIDED') throw new AppException('ITEM_VOIDED', HttpStatus.CONFLICT);

      // Una comanda completada hace más de 30 minutos ya no admite cambios (FR-011).
      const ticket = await this.board.ticket(tx, found.dispatchId, now);
      if (ticket.completedAt && !withinCompletedWindow(new Date(ticket.completedAt), now)) {
        throw new AppException('UNDO_NOT_ALLOWED', HttpStatus.CONFLICT);
      }

      // Un "Listo" que el mozo ya vio no se deshace (AC-2.8).
      const openNotice =
        from === 'READY'
          ? await tx.readyNotice.findFirst({ where: { orderItemId: itemId, withdrawnAt: null }, orderBy: { createdAt: 'desc' } })
          : null;
      if (openNotice?.seenAt) throw new AppException('READY_ALREADY_SEEN', HttpStatus.CONFLICT);

      const updated = await tx.orderItem.updateMany({ where: { id: itemId, status: from }, data: { status: to } });
      if (updated.count === 0) throw await stateConflict(tx, itemId);

      // Retirar el aviso compite con el "Visto" del mozo: gana el primero que confirma.
      if (openNotice) {
        const closed = await tx.readyNotice.updateMany({
          where: { id: openNotice.id, seenAt: null, withdrawnAt: null },
          data: { withdrawnAt: now },
        });
        if (closed.count === 0) throw new AppException('READY_ALREADY_SEEN', HttpStatus.CONFLICT);
      }

      const change = await tx.orderItemStatusChange.create({
        data: { orderItemId: itemId, fromStatus: from, toStatus: to, isUndo: true, changedById: user.id },
      });
      return { item: found, changedAt: change.changedAt, withdrawn: openNotice };
    });

    this.emitStatusChanged(item, from, to, true, changedAt);
    if (withdrawn) {
      this.realtime.emitToUser(withdrawn.recipientId, 'kitchen:ready-notice-closed', { id: withdrawn.id, reason: 'UNDONE' });
    }
    return this.board.ticketItem(item.dispatchId, itemId, new Date());
  }

  private emitStatusChanged(item: SentItem, from: KitchenStatus, to: KitchenStatus, isUndo: boolean, changedAt: Date): void {
    this.realtime.emitToRoles(['KITCHEN', 'WAITER'], 'kitchen:item-status-changed', {
      orderItemId: item.id,
      dispatchId: item.dispatchId,
      tableNumber: item.order.table.tableNumber,
      status: to,
      previousStatus: from,
      isUndo,
      changedAt: changedAt.toISOString(),
    });
  }
}

/** Ítem enviado a cocina; uno inexistente o aún no enviado se trata como inexistente. */
async function findSentItem(tx: Tx, itemId: string): Promise<SentItem> {
  const item = await tx.orderItem.findUnique({ where: { id: itemId }, include: SENT_ITEM_INCLUDE });
  if (!item?.dispatchId) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: ITEM_NOT_FOUND });
  return { ...item, dispatchId: item.dispatchId };
}

/** El estado ya no era el que vio la pantalla: se informa el actual para que lo muestre. */
async function stateConflict(tx: Tx, itemId: string): Promise<AppException> {
  const { status } = await tx.orderItem.findUniqueOrThrow({ where: { id: itemId }, select: { status: true } });
  if (status === 'VOIDED') return new AppException('ITEM_VOIDED', HttpStatus.CONFLICT);
  return new AppException('ITEM_STATE_CONFLICT', HttpStatus.CONFLICT, { details: { current: status } });
}
