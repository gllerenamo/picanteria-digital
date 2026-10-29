import { HttpStatus } from '@nestjs/common';
import type { OrderStatus, Prisma } from '@prisma/client';
import { AppException } from '../common/app.exception';

type Tx = Prisma.TransactionClient;

/**
 * Clave del bloqueo de asesoría que serializa la creación de envíos: así `sequence` sigue el
 * orden de confirmación, sin huecos (specs/003-mesas-pedidos/research.md §4).
 */
export const DISPATCH_LOCK_KEY = 3003;

/** Toma el bloqueo de envío hasta el fin de la transacción. Va antes que `lockOpenOrder`. */
export async function acquireDispatchLock(tx: Tx): Promise<void> {
  // $executeRaw: pg_advisory_xact_lock devuelve `void`, que $queryRaw no sabe leer.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DISPATCH_LOCK_KEY}::bigint)`;
}

export interface LockedOrder {
  id: string;
  tableId: string;
  waiterId: string;
  status: OrderStatus;
}

interface LockedOrderRow {
  id: string;
  table_id: string;
  waiter_id: string;
  status: OrderStatus;
}

/**
 * Bloquea la fila del pedido hasta el fin de la transacción, para que dos mozos que atienden la
 * misma mesa no se crucen (research.md §6). Exige que el pedido siga abierto.
 */
export async function lockOpenOrder(tx: Tx, orderId: string): Promise<LockedOrder> {
  const rows = await tx.$queryRaw<LockedOrderRow[]>`
    SELECT id, table_id, waiter_id, status::text AS status
    FROM orders
    WHERE id = ${orderId}::uuid
    FOR UPDATE`;
  const row = rows[0];
  if (!row) {
    throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'El pedido no existe' });
  }
  if (row.status !== 'OPEN') {
    throw new AppException('ORDER_NOT_OPEN', HttpStatus.CONFLICT);
  }
  return { id: row.id, tableId: row.table_id, waiterId: row.waiter_id, status: row.status };
}
