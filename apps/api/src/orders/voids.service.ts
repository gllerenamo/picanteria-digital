import { HttpStatus, Injectable } from '@nestjs/common';
import type { VoidOrderItemRequest, VoidResult } from '@picanteria/shared';
import type { Prisma } from '@prisma/client';
import { AppException } from '../common/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { activeQuantity, ORDER_ITEM_INCLUDE, toOrderItem, type Viewer } from './order-mapper';

type Tx = Prisma.TransactionClient;

/** Anulación total o parcial de un ítem enviado, solo con autorización (FR-028 a FR-032). */
@Injectable()
export class VoidsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async void(itemId: string, input: VoidOrderItemRequest, admin: Viewer): Promise<VoidResult> {
    const { item, itemVoid, tableNumber } = await this.prisma.$transaction(async (tx) => {
      const found = await tx.orderItem.findUnique({
        where: { id: itemId },
        include: { order: { select: { status: true, table: { select: { tableNumber: true } } } } },
      });
      if (!found) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'El ítem no existe' });
      if (found.order.status !== 'OPEN') throw new AppException('ORDER_NOT_OPEN', HttpStatus.CONFLICT);

      // Actualización condicionada, igual que los pasos de cocina (research.md §7): entre una
      // anulación y un "Listo" simultáneos gana la primera que confirma.
      const updated = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE order_items
        SET voided_quantity = voided_quantity + ${input.units}::int,
            status = CASE WHEN voided_quantity + ${input.units}::int = quantity
                          THEN 'VOIDED'::"OrderItemStatus" ELSE status END,
            updated_at = now()
        WHERE id = ${itemId}::uuid
          AND status IN ('PENDING', 'PREPARING')
          AND quantity - voided_quantity >= ${input.units}::int
        RETURNING id`;
      if (updated.length === 0) throw await this.notVoidable(tx, itemId);

      const created = await tx.itemVoid.create({
        data: { orderItemId: itemId, units: input.units, reason: input.reason, voidedById: admin.id },
        include: { voidedBy: { select: { id: true, fullName: true } } },
      });
      return {
        item: await tx.orderItem.findUniqueOrThrow({ where: { id: itemId }, include: ORDER_ITEM_INCLUDE }),
        itemVoid: created,
        tableNumber: found.order.table.tableNumber,
      };
    });

    // Un ítem enviado siempre tiene envío (CHECK de la migración).
    if (item.dispatchId) {
      this.realtime.emitToRoles(['KITCHEN', 'WAITER'], 'orders:item-voided', {
        itemVoidId: itemVoid.id,
        orderItemId: item.id,
        dispatchId: item.dispatchId,
        tableNumber,
        units: itemVoid.units,
        remainingQuantity: activeQuantity(item),
        voidedAt: itemVoid.voidedAt.toISOString(),
      });
    }

    return {
      itemVoid: {
        id: itemVoid.id,
        units: itemVoid.units,
        reason: itemVoid.reason,
        voidedBy: itemVoid.voidedBy,
        voidedAt: itemVoid.voidedAt.toISOString(),
      },
      item: toOrderItem(item),
    };
  }

  /** Por qué no se pudo anular, para que la pantalla lo explique (AC-5.4). */
  private async notVoidable(tx: Tx, itemId: string): Promise<AppException> {
    const item = await tx.orderItem.findUniqueOrThrow({ where: { id: itemId } });
    const remainingQuantity = activeQuantity(item);
    const reason =
      item.status === 'READY'
        ? 'READY'
        : item.status === 'VOIDED'
          ? 'VOIDED'
          : item.status === 'DRAFT'
            ? 'NOT_SENT'
            : 'NOT_ENOUGH_UNITS';
    return new AppException('ITEM_NOT_VOIDABLE', HttpStatus.CONFLICT, {
      ...(reason === 'READY' ? { message: 'El plato ya está listo; no se puede anular' } : {}),
      details: { reason, remainingQuantity },
    });
  }
}
