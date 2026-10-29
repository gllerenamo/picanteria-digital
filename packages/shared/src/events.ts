import type { ReadyNotice } from './schemas/kitchen';
import type { TableStatus } from './schemas/menu';

/** Eventos de tiempo real (specs/001-base-comun/contracts/websocket-events.md). */
export const REALTIME_EVENTS = {
  SESSION_REVOKED: 'auth:session-revoked',
  PROFILE_CHANGED: 'auth:profile-changed',
  // 003-mesas-pedidos (specs/003-mesas-pedidos/contracts/websocket-events.md).
  DISPATCH_SENT: 'orders:dispatch-sent',
  ITEM_VOIDED: 'orders:item-voided',
  TABLE_STATUS_CHANGED: 'orders:table-status-changed',
  // 004-cocina (specs/004-cocina/contracts/websocket-events.md).
  ITEM_STATUS_CHANGED: 'kitchen:item-status-changed',
  READY_NOTICE: 'kitchen:ready-notice',
  READY_NOTICE_CLOSED: 'kitchen:ready-notice-closed',
  VOID_ACKNOWLEDGED: 'kitchen:void-acknowledged',
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

/** Aviso de plato listo para el mozo responsable de la mesa. */
export type ReadyNoticePayload = ReadyNotice;

/** El aviso se cerró: el mozo tocó "Visto" o la cocina deshizo el "Listo". */
export interface ReadyNoticeClosedPayload {
  id: string;
  reason: 'SEEN' | 'UNDONE';
}

/** Alguien de cocina tocó "Entendido" en un aviso de anulación. */
export interface VoidAcknowledgedPayload {
  itemVoidId: string;
}

/** Tipado de los eventos que el servidor envía al cliente. */
export interface ServerToClientEvents {
  'auth:session-revoked': (payload: SessionRevokedPayload) => void;
  'auth:profile-changed': (payload: ProfileChangedPayload) => void;
  'orders:dispatch-sent': (payload: DispatchSentPayload) => void;
  'orders:item-voided': (payload: ItemVoidedPayload) => void;
  'orders:table-status-changed': (payload: TableStatusChangedPayload) => void;
  'kitchen:item-status-changed': (payload: ItemStatusChangedPayload) => void;
  'kitchen:ready-notice': (payload: ReadyNoticePayload) => void;
  'kitchen:ready-notice-closed': (payload: ReadyNoticeClosedPayload) => void;
  'kitchen:void-acknowledged': (payload: VoidAcknowledgedPayload) => void;
}
