import { ERROR_MESSAGES, apiErrorSchema, type ErrorCode } from '@picanteria/shared';
import type { z } from 'zod';

export const NETWORK_ERROR_MESSAGE = 'No hay conexión. Inténtalo de nuevo.';
const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Error de la API con su código estable y el mensaje en español para mostrar. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** Cabeceras adicionales de una petición (por ejemplo, `Idempotency-Key` del envío a cocina). */
type ExtraHeaders = Record<string, string>;

async function request(method: Method, path: string, body?: unknown, extraHeaders?: ExtraHeaders): Promise<Response> {
  const headers: Record<string, string> = { ...extraHeaders, Accept: 'application/json' };
  if (MUTATING_METHODS.has(method)) headers['X-Requested-With'] = 'picanteria-web';
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(new URL(path, window.location.origin), {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', NETWORK_ERROR_MESSAGE, 0);
  }

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
    if (parsed.success) {
      const { code, message, details } = parsed.data;
      throw new ApiError(code, message, response.status, details);
    }
    throw new ApiError('INTERNAL_ERROR', ERROR_MESSAGES.INTERNAL_ERROR, response.status);
  }
  return response;
}

/** Petición cuya respuesta JSON se valida con un esquema compartido. */
export async function requestJson<TSchema extends z.ZodTypeAny>(
  method: Method,
  path: string,
  schema: TSchema,
  body?: unknown,
  headers?: ExtraHeaders,
): Promise<z.output<TSchema>> {
  const response = await request(method, path, body, headers);
  return schema.parse(await response.json()) as z.output<TSchema>;
}

/** Petición sin cuerpo de respuesta (204). */
export async function requestVoid(method: Method, path: string, body?: unknown, headers?: ExtraHeaders): Promise<void> {
  await request(method, path, body, headers);
}
