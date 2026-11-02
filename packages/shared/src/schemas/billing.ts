import { z } from 'zod';
import { TABLE_STATUS } from './menu';
import { moneySchema, ORDER_STATUS, userRefSchema } from './orders';

/** Contratos de caja y reportes (specs/005-caja-reportes/contracts/rest-api.yaml). */

export const PAYMENT_METHODS = ['CASH', 'YAPE_PLIN', 'CARD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Etiquetas visibles de los métodos de pago (Principio III). */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  YAPE_PLIN: 'Yape/Plin',
  CARD: 'Tarjeta',
};

export const PAYMENT_STATUS = ['VALID', 'VOIDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const SPLIT_MODES = ['EQUAL', 'BY_ITEMS'] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

export const SPLIT_PARTS_MIN = 2;
export const SPLIT_PARTS_MAX = 20;
export const PAYMENT_REFERENCE_MAX = 40;
export const PART_LABEL_MAX = 30;
export const VOID_PAYMENT_REASON_MIN = 3;
export const VOID_PAYMENT_REASON_MAX = 200;
export const CLOSURE_NOTES_MIN = 5;
export const CLOSURE_NOTES_MAX = 300;
/** Rango máximo de los reportes (FR-022). */
export const REPORT_MAX_DAYS = 366;

// ---------------------------------------------------------------------------
// Peticiones

/** Hasta 2 decimales: el monto se guarda en céntimos exactos. */
const hasAtMostTwoDecimals = (value: number): boolean => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

const amountSchema = (label: string) =>
  z
    .number({ required_error: `Indica el ${label}`, invalid_type_error: `El ${label} debe ser un número` })
    .finite(`El ${label} debe ser un número`)
    .refine(hasAtMostTwoDecimals, { message: `El ${label} admite hasta 2 decimales` });

export const createPaymentSchema = z
  .object({
    method: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: 'Elige el método de pago' }) }),
    amount: amountSchema('monto').refine((value) => value > 0, { message: 'El monto debe ser mayor que cero' }),
    receivedAmount: amountSchema('monto recibido')
      .refine((value) => value > 0, { message: 'El monto recibido debe ser mayor que cero' })
      .optional(),
    reference: z
      .string()
      .trim()
      .max(PAYMENT_REFERENCE_MAX, 'La referencia no puede superar 40 caracteres')
      .optional(),
    partId: z.string().uuid('Parte inválida').optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.method === 'CASH' && value.receivedAmount === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['receivedAmount'], message: 'Indica el monto recibido' });
    }
    if (value.method !== 'CASH' && value.receivedAmount !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['receivedAmount'],
        message: 'El monto recibido solo se indica en efectivo',
      });
    }
    if (value.method === 'CASH' && value.reference !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reference'],
        message: 'La referencia solo se indica con Yape/Plin o tarjeta',
      });
    }
  });
export type CreatePaymentRequest = z.infer<typeof createPaymentSchema>;

export const voidPaymentSchema = z
  .object({
    reason: z
      .string({ required_error: 'Indica el motivo' })
      .trim()
      .min(VOID_PAYMENT_REASON_MIN, 'El motivo debe tener al menos 3 caracteres')
      .max(VOID_PAYMENT_REASON_MAX, 'El motivo no puede superar 200 caracteres'),
  })
  .strict();
export type VoidPaymentRequest = z.infer<typeof voidPaymentSchema>;

const partsCountSchema = z
  .number({ required_error: 'Indica la cantidad de personas', invalid_type_error: 'La cantidad de personas debe ser un número' })
  .int('La cantidad de personas debe ser un número entero')
  .min(SPLIT_PARTS_MIN, 'Divide entre al menos 2 personas')
  .max(SPLIT_PARTS_MAX, 'Divide entre como máximo 20 personas');

export const splitPartInputSchema = z
  .object({
    label: z.string().trim().max(PART_LABEL_MAX, 'El nombre de la parte no puede superar 30 caracteres').optional(),
    items: z
      .array(
        z
          .object({
            orderItemId: z.string().uuid('Ítem inválido'),
            units: z
              .number({ invalid_type_error: 'Las unidades deben ser un número' })
              .int('Las unidades deben ser un número entero')
              .min(1, 'Asigna al menos 1 unidad'),
          })
          .strict(),
      )
      .min(1, 'Cada parte debe tener al menos un ítem'),
  })
  .strict();
export type SplitPartInput = z.infer<typeof splitPartInputSchema>;

export const createSplitSchema = z.discriminatedUnion(
  'mode',
  [
    z.object({ mode: z.literal('EQUAL'), parts: partsCountSchema }).strict(),
    z
      .object({
        mode: z.literal('BY_ITEMS'),
        parts: z
          .array(splitPartInputSchema)
          .min(SPLIT_PARTS_MIN, 'Divide entre al menos 2 partes')
          .max(SPLIT_PARTS_MAX, 'Divide entre como máximo 20 partes'),
      })
      .strict(),
  ],
  { errorMap: () => ({ message: 'Elige cómo dividir la cuenta' }) },
);
export type CreateSplitRequest = z.infer<typeof createSplitSchema>;

const countedSchema = (label: string) =>
  amountSchema(`monto contado de ${label}`).refine((value) => value >= 0, {
    message: `El monto contado de ${label} no puede ser negativo`,
  });

export const closureCountsSchema = z
  .object({
    countedCash: countedSchema('efectivo'),
    countedYapePlin: countedSchema('Yape/Plin'),
    countedCard: countedSchema('tarjeta'),
  })
  .strict();
export type ClosureCounts = z.infer<typeof closureCountsSchema>;

export const confirmClosureSchema = closureCountsSchema
  .extend({
    notes: z
      .string()
      .trim()
      .min(CLOSURE_NOTES_MIN, 'La observación debe tener al menos 5 caracteres')
      .max(CLOSURE_NOTES_MAX, 'La observación no puede superar 300 caracteres')
      .optional(),
  })
  .strict();
export type ConfirmClosureRequest = z.infer<typeof confirmClosureSchema>;

/** Fecha de calendario `YYYY-MM-DD` que existe (zona de Perú). */
const dateSchema = (label: string) =>
  z
    .string({ required_error: `Indica la fecha ${label}` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `La fecha ${label} debe tener el formato AAAA-MM-DD`)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
    }, `La fecha ${label} no existe`);

export const dateRangeQuerySchema = z.object({
  from: dateSchema('inicial'),
  to: dateSchema('final'),
});
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

export const TOP_DISHES_SORT = ['units', 'amount'] as const;
export type TopDishesSort = (typeof TOP_DISHES_SORT)[number];

export const topDishesQuerySchema = dateRangeQuerySchema.extend({
  sortBy: z.enum(TOP_DISHES_SORT, { errorMap: () => ({ message: 'Ordena por unidades o por monto' }) }).default('units'),
});
export type TopDishesQuery = z.infer<typeof topDishesQuerySchema>;

/** Días entre dos fechas `YYYY-MM-DD` (0 si son iguales; negativo si `to` es anterior). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Respuestas

export const accountSummarySchema = z.object({
  orderId: z.string().uuid(),
  tableNumber: z.number().int(),
  tableStatus: z.enum(TABLE_STATUS),
  waiter: userRefSchema,
  total: moneySchema,
  paid: moneySchema,
  pending: moneySchema,
});
export type AccountSummary = z.infer<typeof accountSummarySchema>;

export const accountItemSchema = z.object({
  orderItemId: z.string().uuid(),
  menuItem: z.object({ id: z.string().uuid(), name: z.string() }),
  quantity: z.number().int(),
  voidedQuantity: z.number().int(),
  activeQuantity: z.number().int(),
  unitPrice: moneySchema,
  subtotal: moneySchema,
  /** Unidades cubiertas por partes ya pagadas (división por ítems). */
  paidUnits: z.number().int(),
});
export type AccountItem = z.infer<typeof accountItemSchema>;

export const paymentSchema = z.object({
  id: z.string().uuid(),
  method: z.enum(PAYMENT_METHODS),
  amount: moneySchema,
  receivedAmount: moneySchema.nullable(),
  changeAmount: moneySchema.nullable(),
  reference: z.string().nullable(),
  partId: z.string().uuid().nullable(),
  cashier: userRefSchema,
  paidAt: z.string().datetime(),
  status: z.enum(PAYMENT_STATUS),
  voidReason: z.string().nullable(),
  voidedBy: userRefSchema.nullable(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const billPartSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  label: z.string(),
  amount: moneySchema,
  paid: moneySchema,
  pending: moneySchema,
  /** Vacío en modo EQUAL. */
  items: z.array(z.object({ orderItemId: z.string().uuid(), name: z.string(), units: z.number().int() })),
});
export type BillPart = z.infer<typeof billPartSchema>;

export const accountDetailSchema = z.object({
  orderId: z.string().uuid(),
  orderStatus: z.enum(ORDER_STATUS),
  table: z.object({ id: z.string().uuid(), tableNumber: z.number().int(), status: z.enum(TABLE_STATUS) }),
  waiter: userRefSchema,
  items: z.array(accountItemSchema),
  total: moneySchema,
  paid: moneySchema,
  pending: moneySchema,
  payments: z.array(paymentSchema),
  split: z
    .object({
      id: z.string().uuid(),
      mode: z.enum(SPLIT_MODES),
      isStale: z.boolean(),
      parts: z.array(billPartSchema),
    })
    .nullable(),
  canCharge: z.boolean(),
  canCloseWithoutCharge: z.boolean(),
});
export type AccountDetail = z.infer<typeof accountDetailSchema>;

export const closureLineSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  expected: moneySchema,
  counted: moneySchema,
  /** Positivo = sobrante, negativo = faltante. */
  difference: moneySchema,
});
export type ClosureLine = z.infer<typeof closureLineSchema>;

export const closureSummarySchema = z.object({
  startedAt: z.string().datetime().nullable(),
  lines: z.array(closureLineSchema),
  total: moneySchema,
  accountsCount: z.number().int(),
  hasDifferences: z.boolean(),
});
export type ClosureSummary = z.infer<typeof closureSummarySchema>;

export const dayClosureSchema = closureSummarySchema.extend({
  id: z.string().uuid(),
  closedAt: z.string().datetime(),
  cashier: userRefSchema,
  notes: z.string().nullable(),
});
export type DayClosure = z.infer<typeof dayClosureSchema>;

export const salesReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  total: moneySchema,
  accountsCount: z.number().int(),
  averageTicket: moneySchema,
  byDay: z.array(z.object({ date: z.string(), total: moneySchema, accountsCount: z.number().int() })),
  /** Siempre los tres métodos, en cero si no hay ventas. */
  byMethod: z.array(z.object({ method: z.enum(PAYMENT_METHODS), total: moneySchema })),
});
export type SalesReport = z.infer<typeof salesReportSchema>;

export const topDishSchema = z.object({
  rank: z.number().int(),
  menuItem: z.object({ id: z.string().uuid(), name: z.string() }),
  units: z.number().int(),
  amount: moneySchema,
});
export type TopDish = z.infer<typeof topDishSchema>;
