/**
 * Clave de idempotencia del envío a cocina, por pedido (research.md §5). Se crea al tocar
 * "Enviar a cocina" y se reutiliza en los reintentos hasta una respuesta definitiva, también
 * después de recargar la página. Si `sessionStorage` no está disponible, queda en memoria.
 */

const STORAGE_PREFIX = 'picanteria:envio:';
const memory = new Map<string, string>();

/**
 * UUID v4 con `crypto.getRandomValues`: `crypto.randomUUID` no existe en contextos no seguros,
 * como la demo abierta por `http://` desde la tablet en la red local.
 */
function uuidV4(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function read(orderId: string): string | null {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + orderId) ?? memory.get(orderId) ?? null;
  } catch {
    return memory.get(orderId) ?? null;
  }
}

export function getOrCreateKey(orderId: string): string {
  const existing = read(orderId);
  if (existing) return existing;
  const key = uuidV4();
  memory.set(orderId, key);
  try {
    sessionStorage.setItem(STORAGE_PREFIX + orderId, key);
  } catch {
    // Sin sessionStorage la clave sigue en memoria mientras la pestaña esté abierta.
  }
  return key;
}

export function clearKey(orderId: string): void {
  memory.delete(orderId);
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + orderId);
  } catch {
    // Nada que limpiar.
  }
}

/** ¿Hay un envío sin confirmar para este pedido? (el botón dice "Reintentar"). */
export function hasPendingKey(orderId: string): boolean {
  return read(orderId) !== null;
}
