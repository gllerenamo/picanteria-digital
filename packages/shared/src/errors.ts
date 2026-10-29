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
  INTERNAL_ERROR: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
};

export const apiErrorSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
