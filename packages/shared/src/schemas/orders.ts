import { z } from 'zod';
import { TABLE_STATUS } from './menu';

/** Contratos de mesas y pedidos (specs/003-mesas-pedidos/contracts/rest-api.yaml). */

export const ORDER_STATUS = ['OPEN', 'PAID', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const ORDER_ITEM_STATUS = ['DRAFT', 'PENDING', 'PREPARING', 'READY', 'VOIDED'] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUS)[number];

/** Etiquetas visibles de los estados del ítem (Principio III). */
export const ORDER_ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
  DRAFT: 'Por enviar',
  PENDING: 'Pendiente',
  PREPARING: 'En preparación',
  READY: 'Listo',
  VOIDED: 'Anulado',
};

export const GUEST_COUNT_MIN = 1;
export const GUEST_COUNT_MAX = 50;
export const QUANTITY_MAX = 99;
export const NOTES_MAX = 140;

// ---------------------------------------------------------------------------
// Peticiones

const guestCountSchema = z
  .number({ invalid_type_error: 'El número de comensales debe ser un número' })
  .int('El número de comensales debe ser un número entero')
  .min(GUEST_COUNT_MIN, 'Indica al menos 1 comensal')
  .max(GUEST_COUNT_MAX, 'El número de comensales no puede superar 50');

const quantitySchema = z
  .number({ required_error: 'Indica la cantidad', invalid_type_error: 'La cantidad debe ser un número' })
  .int('La cantidad debe ser un número entero')
  .min(1, 'La cantidad mínima es 1')
  .max(QUANTITY_MAX, 'La cantidad máxima es 99');

/** Nota de un ítem; el servicio guarda una nota vacía como `null`. */
const notesSchema = z.string().trim().max(NOTES_MAX, 'La nota no puede superar 140 caracteres').nullable();

export const openOrderSchema = z
  .object({
    tableId: z.string({ required_error: 'Selecciona una mesa' }).uuid('Mesa inválida'),
    guestCount: guestCountSchema.nullable().optional(),
  })
  .strict();
export type OpenOrderRequest = z.infer<typeof openOrderSchema>;

export const updateOrderSchema = z
  .object({
    guestCount: guestCountSchema.nullable(),
  })
  .strict();
export type UpdateOrderRequest = z.infer<typeof updateOrderSchema>;

export const addOrderItemSchema = z
  .object({
    menuItemId: z.string({ required_error: 'Selecciona un plato' }).uuid('Plato inválido'),
    quantity: quantitySchema,
    notes: notesSchema.optional(),
    confirmReopen: z.boolean().optional(),
  })
  .strict();
export type AddOrderItemRequest = z.infer<typeof addOrderItemSchema>;

export const updateOrderItemSchema = z
  .object({
    quantity: quantitySchema.optional(),
    notes: notesSchema.optional(),
  })
  .strict()
  .refine((value) => value.quantity !== undefined || value.notes !== undefined, {
    message: 'Indica la cantidad o la nota',
  });
export type UpdateOrderItemRequest = z.infer<typeof updateOrderItemSchema>;

export const voidOrderItemSchema = z
  .object({
    units: z
      .number({ required_error: 'Indica cuántas unidades anular', invalid_type_error: 'Las unidades deben ser un número' })
      .int('Las unidades deben ser un número entero')
      .min(1, 'Anula al menos 1 unidad'),
    reason: z
      .string({ required_error: 'Indica el motivo de la anulación' })
      .trim()
      .min(3, 'El motivo debe tener al menos 3 caracteres')
      .max(200, 'El motivo no puede superar 200 caracteres'),
  })
  .strict();
export type VoidOrderItemRequest = z.infer<typeof voidOrderItemSchema>;

/** Cabecera `Idempotency-Key` del envío a cocina (FR-022). */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const idempotencyKeySchema = z
  .string({ required_error: 'Falta la clave de envío' })
  .uuid('La clave de envío no es válida');

// ---------------------------------------------------------------------------
// Respuestas

export const moneySchema = z.object({
  amount: z.number(),
  formatted: z.string(),
});
export type Money = z.infer<typeof moneySchema>;

export const userRefSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
});
export type UserRef = z.infer<typeof userRefSchema>;

export const tableOverviewSchema = z.object({
  id: z.string().uuid(),
  tableNumber: z.number().int(),
  capacity: z.number().int(),
  status: z.enum(TABLE_STATUS),
  order: z
    .object({
      id: z.string().uuid(),
      waiter: userRefSchema,
      guestCount: z.number().int().nullable(),
      openedAt: z.string().datetime(),
      hasUnsentItems: z.boolean(),
    })
    .nullable(),
});
export type TableOverview = z.infer<typeof tableOverviewSchema>;

export const itemVoidSchema = z.object({
  id: z.string().uuid(),
  units: z.number().int().min(1),
  reason: z.string(),
  voidedBy: userRefSchema,
  voidedAt: z.string().datetime(),
});
export type ItemVoid = z.infer<typeof itemVoidSchema>;

export const orderItemResponseSchema = z.object({
  id: z.string().uuid(),
  menuItem: z.object({ id: z.string().uuid(), name: z.string() }),
  quantity: z.number().int().min(1),
  voidedQuantity: z.number().int().min(0),
  activeQuantity: z.number().int().min(0),
  notes: z.string().nullable(),
  status: z.enum(ORDER_ITEM_STATUS),
  dispatchId: z.string().uuid().nullable(),
  unitPrice: moneySchema.nullable(),
  subtotal: moneySchema.nullable(),
  currentPrice: moneySchema.nullable(),
  isAvailable: z.boolean().nullable(),
  voids: z.array(itemVoidSchema),
});
export type OrderItemResponse = z.infer<typeof orderItemResponseSchema>;

export const dispatchSummarySchema = z.object({
  id: z.string().uuid(),
  sequence: z.number().int().min(1),
  round: z.number().int().min(1),
  sentBy: userRefSchema,
  sentAt: z.string().datetime(),
});
export type DispatchSummary = z.infer<typeof dispatchSummarySchema>;

export const orderDetailSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(ORDER_STATUS),
  table: z.object({
    id: z.string().uuid(),
    tableNumber: z.number().int(),
    status: z.enum(TABLE_STATUS),
  }),
  waiter: userRefSchema,
  guestCount: z.number().int().nullable(),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  items: z.array(orderItemResponseSchema),
  dispatches: z.array(dispatchSummarySchema),
  consumption: z.object({ total: moneySchema }),
  canCancel: z.boolean(),
  canRequestBill: z.boolean(),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

export const dispatchResponseSchema = dispatchSummarySchema.extend({
  orderId: z.string().uuid(),
  tableNumber: z.number().int(),
  items: z.array(orderItemResponseSchema),
});
export type DispatchResponse = z.infer<typeof dispatchResponseSchema>;

export const voidResultSchema = z.object({
  itemVoid: itemVoidSchema,
  item: orderItemResponseSchema,
});
export type VoidResult = z.infer<typeof voidResultSchema>;
