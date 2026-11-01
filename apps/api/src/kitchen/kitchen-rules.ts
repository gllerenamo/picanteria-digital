import { COMPLETED_WINDOW_MINUTES, type KitchenItemStatus, type TicketState } from '@picanteria/shared';
import type { OrderItemStatus } from '@prisma/client';

/** Reglas de estado de la cocina, sin acceso a datos (specs/004-cocina/data-model.md §2 y §3). */

export type StepFrom = 'PENDING' | 'PREPARING';
export type UndoFrom = 'PREPARING' | 'READY';

/** Un paso por toque: Pendiente → En preparación → Listo (FR-009). */
export function nextStatus(from: StepFrom): 'PREPARING' | 'READY' {
  return from === 'PENDING' ? 'PREPARING' : 'READY';
}

/** "Deshacer" retrocede un paso; los estados son lineales (research.md §3). */
export function previousStatus(from: UndoFrom): 'PENDING' | 'PREPARING' {
  return from === 'READY' ? 'PREPARING' : 'PENDING';
}

/** Un ítem enviado nunca está en DRAFT (CHECK `order_items_dispatch_check` de la 003). */
export function asKitchenStatus(status: OrderItemStatus): KitchenItemStatus {
  if (status === 'DRAFT') throw new Error('Un ítem enviado a cocina no puede estar por enviar');
  return status;
}

export interface ItemSnapshot {
  status: KitchenItemStatus;
  /** Hora en que pasó a Listo; nula si no está listo. */
  readyAt: Date | null;
}

export interface TicketTiming {
  state: TicketState;
  completedAt: Date | null;
}

/** Estado derivado de la comanda y hora en que se completó (data-model.md §3). */
export function ticketTiming(items: readonly ItemSnapshot[]): TicketTiming {
  const live = items.filter((item) => item.status !== 'VOIDED');
  if (live.length === 0) return { state: 'VOIDED', completedAt: null };
  if (!live.every((item) => item.status === 'READY')) return { state: 'ACTIVE', completedAt: null };
  const readyTimes = live.map((item) => item.readyAt?.getTime() ?? 0);
  return { state: 'COMPLETED', completedAt: new Date(Math.max(...readyTimes)) };
}

const COMPLETED_WINDOW_MS = COMPLETED_WINDOW_MINUTES * 60_000;

/** Una comanda completada sigue en "Completadas" y admite "Deshacer" durante 30 minutos (FR-013). */
export function withinCompletedWindow(completedAt: Date, now: Date): boolean {
  return now.getTime() - completedAt.getTime() < COMPLETED_WINDOW_MS;
}

/** ¿Se puede deshacer el último paso del ítem? (FR-011, AC-2.8) */
export function canUndo(item: { status: KitchenItemStatus; noticeSeen: boolean }, ticket: TicketTiming, now: Date): boolean {
  if (item.status === 'PENDING' || item.status === 'VOIDED') return false;
  if (ticket.completedAt && !withinCompletedWindow(ticket.completedAt, now)) return false;
  return !(item.status === 'READY' && item.noticeSeen);
}
