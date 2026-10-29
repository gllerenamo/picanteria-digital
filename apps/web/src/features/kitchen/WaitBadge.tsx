import { DELAY_CRITICAL_MINUTES, DELAY_WARNING_MINUTES } from '@picanteria/shared';

/** Minutos enteros entre dos instantes (nunca negativos). */
export function minutesBetween(fromIso: string, toMs: number): number {
  return Math.max(0, Math.floor((toMs - Date.parse(fromIso)) / 60_000));
}

/** Espera de una comanda activa, con la marca de demora en texto además del color (FR-019, FR-020). */
export function WaitBadge({ sentAt, now }: { sentAt: string; now: number }) {
  const minutes = minutesBetween(sentAt, now);
  const level = minutes >= DELAY_CRITICAL_MINUTES ? 'critical' : minutes >= DELAY_WARNING_MINUTES ? 'warning' : 'ok';
  const styles = {
    ok: 'border-line text-ink',
    warning: 'border-amber-700 bg-amber-50 text-amber-900',
    critical: 'border-danger bg-red-50 text-danger',
  }[level];
  const label = { ok: '', warning: ' · Demorado', critical: ' · Muy demorado' }[level];

  return (
    <span className={`rounded-full border-2 px-3 py-1 font-semibold whitespace-nowrap ${styles}`}>
      {minutes} min{label}
    </span>
  );
}
