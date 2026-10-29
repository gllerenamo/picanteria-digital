import { HttpStatus, Injectable } from '@nestjs/common';
import type { AddOrderItemRequest, OrderItemResponse, UpdateOrderItemRequest } from '@picanteria/shared';
import type { Prisma } from '@prisma/client';
import { AppException } from '../common/app.exception';
import { TablesService } from '../menu/tables.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { lockOpenOrder } from './order-locks';
import { ORDER_ITEM_INCLUDE, toOrderItem } from './order-mapper';
import { normalizeNotes } from './params';

type Tx = Prisma.TransactionClient;

/** Ítems por enviar: agregar, cambiar y quitar sin autorización de nadie (FR-010 a FR-013). */
@Injectable()
export class OrderItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tables: TablesService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Agrega un borrador. Con la mesa por cobrar exige `confirmReopen` y, en la misma
   * transacción, la devuelve a ocupada (FR-034, research.md §14).
   */
  async add(orderId: string, input: AddOrderItemRequest): Promise<OrderItemResponse> {
    const { item, reopenedTable } = await this.prisma.$transaction(async (tx) => {
      const order = await lockOpenOrder(tx, orderId);
      const table = await tx.diningTable.findUniqueOrThrow({ where: { id: order.tableId } });
      let reopened: { id: string; tableNumber: number } | null = null;
      if (table.status === 'POR_COBRAR') {
        if (input.confirmReopen !== true) throw new AppException('TABLE_AWAITING_PAYMENT', HttpStatus.CONFLICT);
        if (!(await this.tables.transition(tx, table.id, ['POR_COBRAR'], 'OCUPADA'))) {
          throw new AppException('TABLE_STATE_CONFLICT', HttpStatus.CONFLICT, { details: { current: table.status } });
        }
        reopened = { id: table.id, tableNumber: table.tableNumber };
      }
      await this.assertAvailable(tx, input.menuItemId);
      const created = await tx.orderItem.create({
        data: {
          orderId,
          menuItemId: input.menuItemId,
          quantity: input.quantity,
          notes: normalizeNotes(input.notes) ?? null,
        },
        include: ORDER_ITEM_INCLUDE,
      });
      return { item: created, reopenedTable: reopened };
    });

    if (reopenedTable) {
      this.realtime.emitToRoles(['WAITER', 'CASHIER'], 'orders:table-status-changed', {
        tableId: reopenedTable.id,
        tableNumber: reopenedTable.tableNumber,
        status: 'OCUPADA',
        orderId,
        changedAt: new Date().toISOString(),
      });
    }
    return toOrderItem(item);
  }

  async update(itemId: string, input: UpdateOrderItemRequest): Promise<OrderItemResponse> {
    const item = await this.prisma.$transaction(async (tx) => {
      await this.lockDraft(tx, itemId);
      return tx.orderItem.update({
        where: { id: itemId },
        data: { quantity: input.quantity, notes: normalizeNotes(input.notes) },
        include: ORDER_ITEM_INCLUDE,
      });
    });
    return toOrderItem(item);
  }

  /** Un borrador quitado se borra: nunca llegó a cocina y no se emite ningún evento. */
  async remove(itemId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockDraft(tx, itemId);
      await tx.orderItem.delete({ where: { id: itemId } });
    });
  }

  /** Bloquea el pedido del ítem y exige que el ítem siga sin enviar (FR-024). */
  private async lockDraft(tx: Tx, itemId: string): Promise<void> {
    const found = await tx.orderItem.findUnique({ where: { id: itemId }, select: { orderId: true } });
    if (!found) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'El ítem no existe' });
    await lockOpenOrder(tx, found.orderId);
    // Se relee con el pedido bloqueado: un envío simultáneo pudo haberlo tomado.
    const item = await tx.orderItem.findUniqueOrThrow({ where: { id: itemId }, select: { status: true } });
    if (item.status !== 'DRAFT') throw new AppException('ITEM_ALREADY_SENT', HttpStatus.CONFLICT);
  }

  /** El plato debe existir y estar disponible y activo en la carta (FR-009). */
  private async assertAvailable(tx: Tx, menuItemId: string): Promise<void> {
    const menuItem = await tx.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'El plato no existe' });
    if (!menuItem.isAvailable || !menuItem.isActive) {
      throw new AppException('MENU_ITEM_UNAVAILABLE', HttpStatus.CONFLICT);
    }
  }
}
