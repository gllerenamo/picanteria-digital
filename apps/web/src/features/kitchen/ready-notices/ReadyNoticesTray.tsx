import { useMarkSeen, useReadyNotices, useReadyNoticesRealtime } from './api';

/**
 * Avisos de plato listo del mozo responsable, visibles en cualquier pantalla hasta tocar "Visto"
 * (FR-015 a FR-017). Se monta en el encabezado de la aplicación para el rol mozo.
 */
export function ReadyNoticesTray() {
  useReadyNoticesRealtime();
  const { data: notices } = useReadyNotices();
  const markSeen = useMarkSeen();
  if (!notices || notices.length === 0) return null;

  return (
    <section aria-label="Platos listos" className="mx-auto w-full max-w-6xl px-4 pb-3">
      <ul className="flex flex-col gap-2">
        {notices.map((notice) => (
          <li
            key={notice.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-success bg-card px-4 py-2"
          >
            <p role="status" className="text-lg font-semibold text-success">
              Mesa {notice.tableNumber}: {notice.quantity} × {notice.itemName} — listo
            </p>
            <button
              type="button"
              onClick={() => {
                markSeen.mutate(notice.id);
              }}
              className="touch-target rounded-lg bg-success px-4 text-lg font-semibold text-white"
            >
              Visto
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
