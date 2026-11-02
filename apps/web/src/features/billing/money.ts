/** Montos en soles para las pantallas de caja y reportes (FR-027). */

/** `S/ 0.00` a partir de céntimos; los negativos llevan el signo delante. */
export function formatSoles(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}S/ ${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** Monto escrito por el usuario (acepta coma decimal); `null` si está vacío o no es un número. */
export function parseAmount(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Fecha y hora día/mes/año en la zona de Perú. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Lima',
  }).format(new Date(iso));
}

/** Fecha `YYYY-MM-DD` como día/mes/año. */
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`;
}
