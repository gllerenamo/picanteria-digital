import { z } from 'zod';

/** Códigos de error estables de la API (specs/001-base-comun/contracts/rest-api.yaml). */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'ACCOUNT_DISABLED',
  'ACCOUNT_LOCKED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'CSRF_HEADER_MISSING',
  'NOT_FOUND',
  'USERNAME_TAKEN',
  'LAST_ADMIN',
  'CANNOT_DISABLE_SELF',
  'ITEM_NAME_TAKEN',
  'CATEGORY_NAME_TAKEN',
  'CATEGORY_NOT_FOUND',
  // 003-mesas-pedidos (specs/003-mesas-pedidos/contracts/rest-api.yaml).
  'TABLE_NOT_AVAILABLE',
  'TABLE_STATE_CONFLICT',
  'ORDER_NOT_OPEN',
  'TABLE_AWAITING_PAYMENT',
  'MENU_ITEM_UNAVAILABLE',
  'ITEM_ALREADY_SENT',
  'NOTHING_TO_SEND',
  'ITEMS_UNAVAILABLE',
  'IDEMPOTENCY_KEY_REUSED',
  'ITEM_NOT_VOIDABLE',
  'HAS_UNSENT_ITEMS',
  'NO_CONSUMPTION',
  'CANCEL_NOT_ALLOWED',
  // 004-cocina (specs/004-cocina/contracts/rest-api.yaml).
  'ITEM_STATE_CONFLICT',
  'ITEM_VOIDED',
  'READY_ALREADY_SEEN',
  'UNDO_NOT_ALLOWED',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Mensajes en español para mostrar al usuario (Principio III). */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Revisa los datos ingresados',
  INVALID_CREDENTIALS: 'Usuario o contraseña incorrectos',
  ACCOUNT_DISABLED: 'Tu cuenta está desactivada. Consulta al administrador.',
  ACCOUNT_LOCKED: 'Cuenta bloqueada por intentos fallidos. Inténtalo de nuevo en 15 minutos.',
  UNAUTHENTICATED: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  FORBIDDEN: 'No tienes permiso para realizar esta acción',
  CSRF_HEADER_MISSING: 'La solicitud no es válida. Recarga la página e inténtalo de nuevo.',
  NOT_FOUND: 'No se encontró lo que buscas',
  USERNAME_TAKEN: 'El nombre de usuario ya existe',
  LAST_ADMIN: 'Debe existir al menos un administrador activo',
  CANNOT_DISABLE_SELF: 'No puedes desactivar tu propia cuenta',
  ITEM_NAME_TAKEN: 'Ya existe un plato con ese nombre en esta categoría',
  CATEGORY_NAME_TAKEN: 'Ya existe una categoría con ese nombre',
  CATEGORY_NOT_FOUND: 'La categoría especificada no existe',
  TABLE_NOT_AVAILABLE: 'La mesa ya no está libre',
  TABLE_STATE_CONFLICT: 'La mesa cambió de estado. Revisa su estado actual.',
  ORDER_NOT_OPEN: 'Este pedido ya está cerrado',
  TABLE_AWAITING_PAYMENT: 'La mesa está por cobrar. Confirma para volver a abrirla y agregar.',
  MENU_ITEM_UNAVAILABLE: 'Este plato ya no está disponible',
  ITEM_ALREADY_SENT: 'Este ítem ya se envió a cocina; solo el administrador puede anularlo',
  NOTHING_TO_SEND: 'No hay nada nuevo que enviar',
  ITEMS_UNAVAILABLE: 'Algunos platos ya no están disponibles. Quítalos o cámbialos para enviar.',
  IDEMPOTENCY_KEY_REUSED: 'La solicitud no es válida. Recarga la página e inténtalo de nuevo.',
  ITEM_NOT_VOIDABLE: 'Este ítem ya no se puede anular',
  HAS_UNSENT_ITEMS: 'Hay ítems sin enviar. Envíalos o quítalos antes de pedir la cuenta.',
  NO_CONSUMPTION: 'La mesa no tiene consumo. Si se abrió por error, cancela la apertura.',
  CANCEL_NOT_ALLOWED: 'No se puede cancelar: esta mesa ya tiene pedidos enviados a cocina.',
  ITEM_STATE_CONFLICT: 'Otro usuario ya cambió este plato. Revisa su estado actual.',
  ITEM_VOIDED: 'Este plato fue anulado',
  READY_ALREADY_SEEN: 'El mozo ya recogió este plato',
  UNDO_NOT_ALLOWED: 'Ya no se puede deshacer este cambio',
  INTERNAL_ERROR: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
};

export const apiErrorSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
