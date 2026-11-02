import { Link, useLocation } from 'react-router';
import { useClosures } from './api';
import { ClosureLinesTable } from './ClosureLinesTable';
import type { CashierNotice } from './messages';
import { formatDateTime } from './money';

/** Historial de cierres (/caja/cierres), más reciente primero (FR-021, AC-3.6). */
export function ClosuresHistoryPage() {
  const { data: closures, isPending, isError } = useClosures();
  const notice = (useLocation().state as CashierNotice | null)?.notice;

  return (
    <section className="flex flex-col gap-4">
      <Link to="/caja" className="touch-target inline-flex items-center self-start text-lg font-medium text-brand underline">
        Volver a caja
      </Link>
      <h1 className="text-3xl font-bold">Historial de cierres</h1>
      {notice && (
        <p role="status" className="rounded-lg border-2 border-success bg-card px-4 py-3 text-lg font-semibold text-success">
          {notice}
        </p>
      )}
      {isPending && <p className="text-lg text-muted">Cargando cierres…</p>}
      {isError && <p className="text-lg text-danger">No se pudieron cargar los cierres.</p>}
      {closures?.length === 0 && <p className="text-lg text-muted">Todavía no hay cierres</p>}
      {closures && closures.length > 0 && (
        <ul className="flex flex-col gap-4" aria-label="Cierres">
          {closures.map((closure) => (
            <li key={closure.id}>
              <article className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4" aria-label={`Cierre del ${formatDateTime(closure.closedAt)}`}>
                <header className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl font-bold">{formatDateTime(closure.closedAt)}</h2>
                  <span className="text-lg text-muted">Cajero: {closure.cashier.fullName}</span>
                </header>
                {closure.startedAt && <p className="text-base text-muted">Desde {formatDateTime(closure.startedAt)}</p>}
                <ClosureLinesTable lines={closure.lines} />
                <p className="flex flex-wrap justify-between gap-2 text-lg">
                  <span className="font-semibold">Total: {closure.total.formatted}</span>
                  <span>Cuentas cobradas: {closure.accountsCount}</span>
                </p>
                {closure.notes && <p className="text-lg">Observación: {closure.notes}</p>}
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
