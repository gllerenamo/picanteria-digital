import { Injectable } from '@nestjs/common';
import { COMPLETED_WINDOW_MINUTES, type KitchenBoard, type Ticket, type TicketItem, type VoidNotice } from '@picanteria/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { asKitchenStatus, canUndo, ticketTiming, withinCompletedWindow } from './kitchen-rules';

type Db = PrismaService | Prisma.TransactionClient;

/** Lo que necesita el tablero de cada envío (contracts/rest-api.yaml § Ticket). */
const TICKET_INCLUDE = {
  order: { select: { table: { select: { tableNumber: true } } } },
  sentBy: { select: { id: true, fullName: true } },
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      menuItem: { select: { name: true } },
      statusChanges: { orderBy: { changedAt: 'desc' }, take: 1, select: { changedAt: true } },
      readyNotices: { orderBy: { createdAt: 'desc' }, take: 1, select: { seenAt: true, withdrawnAt: true } },
      voids: { orderBy: { voidedAt: 'desc' }, take: 1, select: { voidedAt: true } },
    },
  },
} satisfies Prisma.KitchenDispatchInclude;

type TicketRecord = Prisma.KitchenDispatchGetPayload<{ include: typeof TICKET_INCLUDE }>;

const VOID_NOTICE_INCLUDE = {
  orderItem: {
    select: {
      dispatchId: true,
      menuItem: { select: { name: true } },
      order: { select: { table: { select: { tableNumber: true } } } },
    },
  },
} satisfies Prisma.ItemVoidInclude;

/** Tablero de cocina: la fuente de verdad de la pantalla `/cocina` (research.md §6). */
@Injectable()
export class KitchenBoardService {
  constructor(private readonly prisma: PrismaService) {}

  async getBoard(now: Date): Promise<KitchenBoard> {
    const windowStart = new Date(now.getTime() - COMPLETED_WINDOW_MINUTES * 60_000);
    const [records, pendingVoids] = await Promise.all([
      this.prisma.kitchenDispatch.findMany({
        where: {
          OR: [
            { items: { some: { status: { in: ['PENDING', 'PREPARING'] } } } },
            { items: { some: { statusChanges: { some: { changedAt: { gte: windowStart } } } } } },
            { items: { some: { voids: { some: { kitchenAck: null } } } } },
            { sentAt: { gte: windowStart } },
          ],
        },
        include: TICKET_INCLUDE,
        orderBy: { sequence: 'asc' },
      }),
      this.prisma.itemVoid.findMany({
        where: { kitchenAck: null },
        include: VOID_NOTICE_INCLUDE,
        orderBy: { voidedAt: 'asc' },
      }),
    ]);

    const voidNotices = pendingVoids.flatMap((record): VoidNotice[] =>
      record.orderItem.dispatchId
        ? [
            {
              itemVoidId: record.id,
              dispatchId: record.orderItem.dispatchId,
              tableNumber: record.orderItem.order.table.tableNumber,
              itemName: record.orderItem.menuItem.name,
              units: record.units,
              voidedAt: record.voidedAt.toISOString(),
            },
          ]
        : [],
    );
    const withPendingVoids = new Set(voidNotices.map((notice) => notice.dispatchId));
    const tickets = records.map((record) => toTicket(record, now));

    return {
      serverTime: now.toISOString(),
      // Una comanda totalmente anulada sigue visible hasta su "Entendido" (AC-5.4).
      active: tickets.filter(
        (ticket) => ticket.state === 'ACTIVE' || (ticket.state === 'VOIDED' && withPendingVoids.has(ticket.dispatchId)),
      ),
      completed: tickets
        .filter((ticket) => ticket.state === 'COMPLETED' && ticket.completedAt !== null && withinCompletedWindow(new Date(ticket.completedAt), now))
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
      voidNotices,
    };
  }

  /** La comanda de un envío, con sus ítems ya calculados. */
  async ticket(db: Db, dispatchId: string, now: Date): Promise<Ticket> {
    const record = await db.kitchenDispatch.findUniqueOrThrow({ where: { id: dispatchId }, include: TICKET_INCLUDE });
    return toTicket(record, now);
  }

  /** Un ítem tal como lo muestra el tablero (respuesta de advance y undo). */
  async ticketItem(dispatchId: string, itemId: string, now: Date): Promise<TicketItem> {
    const ticket = await this.ticket(this.prisma, dispatchId, now);
    const item = ticket.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error(`El ítem ${itemId} no pertenece al envío ${dispatchId}`);
    return item;
  }
}

function toTicket(record: TicketRecord, now: Date): Ticket {
  const items = record.items.map((item) => {
    const status = asKitchenStatus(item.status);
    const lastChange = item.statusChanges[0]?.changedAt;
    const lastNotice = item.readyNotices[0];
    return {
      item,
      status,
      // Sin cambios de cocina, el ítem está como llegó: pendiente desde el envío.
      changedAt: status === 'VOIDED' ? (item.voids[0]?.voidedAt ?? item.updatedAt) : (lastChange ?? record.sentAt),
      noticeSeen: Boolean(lastNotice && lastNotice.withdrawnAt === null && lastNotice.seenAt !== null),
    };
  });
  const timing = ticketTiming(items.map(({ status, changedAt }) => ({ status, readyAt: status === 'READY' ? changedAt : null })));

  return {
    dispatchId: record.id,
    sequence: record.sequence,
    tableNumber: record.order.table.tableNumber,
    round: record.round,
    sentBy: record.sentBy,
    sentAt: record.sentAt.toISOString(),
    state: timing.state,
    completedAt: timing.completedAt?.toISOString() ?? null,
    items: items.map(({ item, status, changedAt, noticeSeen }) => ({
      id: item.id,
      name: item.menuItem.name,
      quantity: item.quantity,
      voidedQuantity: item.voidedQuantity,
      toPrepare: item.quantity - item.voidedQuantity,
      notes: item.notes,
      status,
      statusChangedAt: changedAt.toISOString(),
      canUndo: canUndo({ status, noticeSeen }, timing, now),
    })),
  };
}
