import { HttpStatus, Injectable } from '@nestjs/common';
import type { DispatchResponse } from '@picanteria/shared';
import { Prisma } from '@prisma/client';
import { AppException } from '../common/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { acquireDispatchLock, lockOpenOrder } from './order-locks';
import { DISPATCH_INCLUDE, toDispatch, type DispatchRecord, type Viewer } from './order-mapper';

type Tx = Prisma.TransactionClient;

interface DraftRow {
  id: string;
  menu_item_id: string;
  name: string;
  is_available: boolean;
  is_active: boolean;
}

/** Envío a cocina idempotente y en orden (research.md §4 a §6 y §8). */
@Injectable()
export class DispatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Envía todos los ítems por enviar. Un reintento con la misma clave devuelve el mismo envío
   * sin crear otro ni emitir de nuevo (FR-022).
   */
  async send(orderId: string, idempotencyKey: string, viewer: Viewer): Promise<DispatchResponse> {
    let result: { dispatch: DispatchRecord; created: boolean };
    try {
      result = await this.prisma.$transaction((tx) => this.sendInTransaction(tx, orderId, idempotencyKey, viewer));
    } catch (error) {
      // Respaldo de la columna única: otro reintento simultáneo ya registró la clave.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.kitchenDispatch.findUnique({ where: { idempotencyKey }, include: DISPATCH_INCLUDE });
        if (existing?.orderId === orderId) return toDispatch(existing);
      }
      throw error;
    }

    const { dispatch, created } = result;
    if (created) {
      this.realtime.emitToRoles(['KITCHEN', 'WAITER'], 'orders:dispatch-sent', {
        dispatchId: dispatch.id,
        sequence: dispatch.sequence,
        round: dispatch.round,
        orderId,
        tableNumber: dispatch.order.table.tableNumber,
        itemCount: dispatch.items.length,
        sentAt: dispatch.sentAt.toISOString(),
      });
    }
    return toDispatch(dispatch);
  }

  private async sendInTransaction(
    tx: Tx,
    orderId: string,
    idempotencyKey: string,
    viewer: Viewer,
  ): Promise<{ dispatch: DispatchRecord; created: boolean }> {
    // 1. Bloqueo global: el orden de `sequence` es el de confirmación.
    await acquireDispatchLock(tx);

    // 2. ¿Es un reintento?
    const existing = await tx.kitchenDispatch.findUnique({ where: { idempotencyKey }, include: DISPATCH_INCLUDE });
    if (existing) {
      if (existing.orderId !== orderId) throw new AppException('IDEMPOTENCY_KEY_REUSED', HttpStatus.CONFLICT);
      return { dispatch: existing, created: false };
    }

    // 3. Pedido abierto y sus borradores bloqueados (un "quitar" simultáneo espera).
    await lockOpenOrder(tx, orderId);
    const drafts = await tx.$queryRaw<DraftRow[]>`
      SELECT oi.id, oi.menu_item_id, mi.name, mi.is_available, mi.is_active
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = ${orderId}::uuid AND oi.status = 'DRAFT'
      FOR UPDATE OF oi`;
    if (drafts.length === 0) throw new AppException('NOTHING_TO_SEND', HttpStatus.CONFLICT);

    // 4. Si algún plato ya no está disponible, no se envía nada (FR-020).
    const unavailable = drafts.filter((draft) => !draft.is_available || !draft.is_active);
    if (unavailable.length > 0) {
      throw new AppException('ITEMS_UNAVAILABLE', HttpStatus.CONFLICT, {
        details: {
          items: unavailable.map((draft) => ({ orderItemId: draft.id, menuItemId: draft.menu_item_id, name: draft.name })),
        },
      });
    }

    // 5. Número correlativo global y ronda dentro del pedido.
    const last = await tx.kitchenDispatch.aggregate({ _max: { sequence: true } });
    const round = (await tx.kitchenDispatch.count({ where: { orderId } })) + 1;
    const dispatch = await tx.kitchenDispatch.create({
      data: {
        orderId,
        sequence: (last._max.sequence ?? 0) + 1,
        round,
        idempotencyKey,
        sentById: viewer.id,
        // Hora tomada con el bloqueo ya adquirido. El valor por defecto `now()` de PostgreSQL es
        // la hora de inicio de la transacción: un envío que esperó el bloqueo quedaría con un
        // número mayor y una hora menor que el anterior (AC-3.6).
        sentAt: new Date(),
      },
    });

    // 6. Los borradores pasan a PENDING con el precio vigente de la carta (FR-025).
    await tx.$executeRaw`
      UPDATE order_items AS oi
      SET status = 'PENDING', dispatch_id = ${dispatch.id}::uuid, unit_price = mi.price, updated_at = now()
      FROM menu_items AS mi
      WHERE mi.id = oi.menu_item_id AND oi.order_id = ${orderId}::uuid AND oi.status = 'DRAFT'`;

    return {
      dispatch: await tx.kitchenDispatch.findUniqueOrThrow({ where: { id: dispatch.id }, include: DISPATCH_INCLUDE }),
      created: true,
    };
  }
}
