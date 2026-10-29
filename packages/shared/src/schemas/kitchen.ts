import { z } from 'zod';

/** Contratos de cocina (specs/004-cocina/contracts/rest-api.yaml). */

/** Estados del ítem que ve la cocina: los enviados (sin `DRAFT`). */
export const KITCHEN_ITEM_STATUS = ['PENDING', 'PREPARING', 'READY', 'VOIDED'] as const;
export type KitchenItemStatus = (typeof KITCHEN_ITEM_STATUS)[number];

/** Estado derivado de una comanda (data-model.md §3). */
export const TICKET_STATE = ['ACTIVE', 'COMPLETED', 'VOIDED'] as const;
export type TicketState = (typeof TICKET_STATE)[number];

/** Desde "Demorado" (ámbar) y "Muy demorado" (rojo), en minutos de espera (FR-020). */
export const DELAY_WARNING_MINUTES = 15;
export const DELAY_CRITICAL_MINUTES = 25;

/** Minutos que una comanda completada sigue en "Completadas" y admite "Deshacer" (FR-011, FR-013). */
export const COMPLETED_WINDOW_MINUTES = 30;

// ---------------------------------------------------------------------------
// Peticiones

/** `from` es el estado que mostraba la pantalla al tocar (research.md §2). */
export const advanceItemSchema = z
  .object({
    from: z.enum(['PENDING', 'PREPARING'], {
      errorMap: () => ({ message: 'Solo se avanza un plato pendiente o en preparación' }),
    }),
  })
  .strict();
export type AdvanceItemRequest = z.infer<typeof advanceItemSchema>;

export const undoItemSchema = z
  .object({
    from: z.enum(['PREPARING', 'READY'], {
      errorMap: () => ({ message: 'Solo se deshace un plato en preparación o listo' }),
    }),
  })
  .strict();
export type UndoItemRequest = z.infer<typeof undoItemSchema>;

// ---------------------------------------------------------------------------
// Respuestas

export const ticketItemSchema = z.object({
  id: z.string().uuid(),
  /** Nombre del plato o bebida. */
  name: z.string(),
  quantity: z.number().int(),
  voidedQuantity: z.number().int(),
  /** `quantity − voidedQuantity`. */
  toPrepare: z.number().int(),
  notes: z.string().nullable(),
  status: z.enum(KITCHEN_ITEM_STATUS),
  statusChangedAt: z.string(),
  canUndo: z.boolean(),
});
export type TicketItem = z.infer<typeof ticketItemSchema>;

export const ticketSchema = z.object({
  dispatchId: z.string().uuid(),
  /** Número correlativo del envío. */
  sequence: z.number().int(),
  tableNumber: z.number().int(),
  /** 1 = primera ronda de la mesa. */
  round: z.number().int(),
  sentBy: z.object({ id: z.string().uuid(), fullName: z.string() }),
  sentAt: z.string(),
  state: z.enum(TICKET_STATE),
  completedAt: z.string().nullable(),
  items: z.array(ticketItemSchema),
});
export type Ticket = z.infer<typeof ticketSchema>;

export const voidNoticeSchema = z.object({
  itemVoidId: z.string().uuid(),
  dispatchId: z.string().uuid(),
  tableNumber: z.number().int(),
  itemName: z.string(),
  units: z.number().int(),
  voidedAt: z.string(),
});
export type VoidNotice = z.infer<typeof voidNoticeSchema>;

export const kitchenBoardSchema = z.object({
  serverTime: z.string(),
  /** Comandas activas y anuladas sin confirmar, por número de envío ascendente. */
  active: z.array(ticketSchema),
  /** Completadas en los últimos 30 minutos, la más reciente primero. */
  completed: z.array(ticketSchema),
  /** Anulaciones sin "Entendido", en orden de llegada. */
  voidNotices: z.array(voidNoticeSchema),
});
export type KitchenBoard = z.infer<typeof kitchenBoardSchema>;

export const readyNoticeSchema = z.object({
  id: z.string().uuid(),
  orderItemId: z.string().uuid(),
  tableNumber: z.number().int(),
  itemName: z.string(),
  quantity: z.number().int(),
  createdAt: z.string(),
});
export type ReadyNotice = z.infer<typeof readyNoticeSchema>;
