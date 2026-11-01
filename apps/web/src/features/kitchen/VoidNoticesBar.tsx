import type { VoidNotice } from '@picanteria/shared';

interface VoidNoticesBarProps {
  notices: readonly VoidNotice[];
  busy: boolean;
  onAcknowledge: (notice: VoidNotice) => void;
}

/** Anulaciones sin confirmar, arriba y en orden de llegada, hasta tocar "Entendido" (FR-027). */
export function VoidNoticesBar({ notices, busy, onAcknowledge }: VoidNoticesBarProps) {
  if (notices.length === 0) return null;
  return (
    <section aria-label="Anulaciones" className="flex flex-col gap-2">
      {notices.map((notice) => (
        <div
          key={notice.itemVoidId}
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-danger bg-red-50 px-4 py-3"
        >
          <p className="font-bold text-danger">
            Mesa {notice.tableNumber}: {notice.units} × {notice.itemName} {notice.units === 1 ? 'anulado' : 'anulados'}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onAcknowledge(notice);
            }}
            className="touch-target rounded-lg bg-danger px-4 text-lg font-semibold text-white disabled:opacity-60"
          >
            Entendido
          </button>
        </div>
      ))}
    </section>
  );
}
