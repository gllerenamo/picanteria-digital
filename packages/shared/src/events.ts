import type { TableStatus } from './schemas/menu';

/** Eventos de tiempo real (specs/001-base-comun/contracts/websocket-events.md). */
export const REALTIME_EVENTS = {
  SESSION_REVOKED: 'auth:session-revoked',
  PROFILE_CHANGED: 'auth:profile-changed',
  // 003-mesas-pedidos (specs/003-mesas-pedidos/contracts/websocket-events.md).
  DISPATCH_SENT: 'orders:dispatch-sent',
  ITEM_VOIDED: 'orders:item-voided',
  TABLE_STATUS_CHANGED: 'orders:table-status-changed',
  // 004-cocina: la vista del mozo lo escucha para ver los cambios de estado.
  ITEM_STATUS_CHANGED: 'kitchen:item-status-changed',
} as const;

export interface SessionRevokedPayload {
  reason: 'USER_DISABLED' | 'LOGGED_OUT';
}

export interface ProfileChangedPayload {
  fields: Array<'fullName' | 'role'>;
}

/** Un envío a cocina quedó registrado. */
export interface DispatchSentPayload {
  dispatchId: string;
  /** Correlativo global; orden del tablero de cocina. */
  sequence: number;
  /** 1, 2, … dentro del pedido. */
  round: number;
  orderId: string;
  tableNumber: number;
  /** Ítems (líneas) del envío. */
  itemCount: number;
  sentAt: string;
}

/** El administrador anuló unidades de un ítem enviado. */
export interface ItemVoidedPayload {
  itemVoidId: string;
  orderItemId: string;
  dispatchId: string;
  tableNumber: number;
  /** Unidades anuladas en esta anulación. */
  units: number;
  /** Unidades que quedan por preparar; 0 = ítem anulado. */
  remainingQuantity: number;
  voidedAt: string;
}

/** Cambió el estado de una mesa. */
export interface TableStatusChangedPayload {
  tableId: string;
  tableNumber: number;
  status: TableStatus;
  /** El pedido que causó el cambio (también el cancelado o el cobrado). */
  orderId: string;
  changedAt: string;
}

type KitchenItemStatus = 'PENDING' | 'PREPARING' | 'READY';

/** Cocina cambió el estado de un ítem (contrato de 004-cocina). */
export interface ItemStatusChangedPayload {
  orderItemId: string;
  dispatchId: string;
  tableNumber: number;
  status: KitchenItemStatus;
  previousStatus: KitchenItemStatus;
  isUndo: boolean;
  changedAt: string;
}

/** Tipado de los eventos que el servidor envía al cliente. */
export interface ServerToClientEvents {
  'auth:session-revoked': (payload: SessionRevokedPayload) => void;
  'auth:profile-changed': (payload: ProfileChangedPayload) => void;
  'orders:dispatch-sent': (payload: DispatchSentPayload) => void;
  'orders:item-voided': (payload: ItemVoidedPayload) => void;
  'orders:table-status-changed': (payload: TableStatusChangedPayload) => void;
  'kitchen:item-status-changed': (payload: ItemStatusChangedPayload) => void;
}
