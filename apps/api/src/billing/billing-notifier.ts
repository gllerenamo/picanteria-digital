import { Injectable } from '@nestjs/common';
import type { AccountUpdatedPayload } from '@picanteria/shared';
import { money } from '../orders/order-mapper';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { accountState, type AccountRecord } from './account-mapper';

/** Eventos de caja (contracts/websocket-events.md). Se llama después de confirmar la transacción. */
@Injectable()
export class BillingNotifier {
  constructor(private readonly realtime: RealtimeGateway) {}

  /** Otros cajeros (y el administrador) refrescan la cuenta y la lista. */
  accountUpdated(record: AccountRecord, reason: AccountUpdatedPayload['reason']): void {
    this.realtime.emitToRoles(['CASHIER'], 'billing:account-updated', {
      orderId: record.id,
      tableNumber: record.table.tableNumber,
      reason,
      pending: money(Math.max(accountState(record).pendingCents, 0)),
      changedAt: new Date().toISOString(),
    });
  }

  /** La mesa quedó libre: los mozos la ven libre sin recargar (003 AC-6.6, SC-006). */
  tableFreed(record: AccountRecord): void {
    this.realtime.emitToRoles(['WAITER', 'CASHIER'], 'orders:table-status-changed', {
      tableId: record.table.id,
      tableNumber: record.table.tableNumber,
      status: 'LIBRE',
      orderId: record.id,
      changedAt: new Date().toISOString(),
    });
  }
}
