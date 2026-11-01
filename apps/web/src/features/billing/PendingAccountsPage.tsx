import { Link, useLocation } from 'react-router';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { usePendingAccounts } from './api';
import { CASHIER_OFFLINE_MESSAGE, type CashierNotice } from './messages';
import { useBillingRealtime } from './useBillingRealtime';

/** Pantalla inicial de caja (/caja): mesas por cobrar en vivo (FR-001, AC-1.1). */
export function PendingAccountsPage() {
  useBillingRealtime();
  const { data: accounts, isPending, isError } = usePendingAccounts();
  const notice = (useLocation().state as CashierNotice | null)?.notice;

  return (
    <section className="flex flex-col gap-4">
      {/* El título "Caja" lo exige la prueba [001] AC-2.5. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Caja</h1>
        <nav aria-label="Cierre" className="flex flex-wrap gap-3">
          <Link
            to="/caja/cierre"
            className="touch-target inline-flex items-center rounded-lg border border-line bg-card px-4 text-lg font-medium active:bg-line"
          >
            Cierre del día
          </Link>
          <Link
            to="/caja/cierres"
            className="touch-target inline-flex items-center rounded-lg border border-line bg-card px-4 text-lg font-medium active:bg-line"
          >
            Historial de cierres
          </Link>
        </nav>
      </div>
      <p className="text-lg text-muted">Mesas por cobrar. Toca una para ver su cuenta y cobrarla.</p>
      <ConnectionBanner message={CASHIER_OFFLINE_MESSAGE} />
      {notice && (
        <p role="status" className="rounded-lg border-2 border-success bg-card px-4 py-3 text-lg font-semibold text-success">
          {notice}
        </p>
      )}
      {isPending && <p className="text-lg text-muted">Cargando cuentas…</p>}
      {isError && <p className="text-lg text-danger">No se pudieron cargar las cuentas.</p>}
      {accounts?.length === 0 && <p className="text-lg text-muted">No hay mesas por cobrar</p>}
      {accounts && accounts.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Mesas por cobrar">
          {accounts.map((account) => (
            <li key={account.orderId} className="flex flex-col">
              <Link
                to={`/caja/cuentas/${account.orderId}`}
                className="touch-target flex flex-1 flex-col gap-1 rounded-xl border-2 border-brand bg-card p-4 active:bg-line"
              >
                <span className="text-2xl font-bold">Mesa {account.tableNumber}</span>
                <span className="text-lg text-muted">{account.waiter.fullName}</span>
                <span className="text-lg">Total: {account.total.formatted}</span>
                <span className="text-lg font-semibold">Saldo: {account.pending.formatted}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
