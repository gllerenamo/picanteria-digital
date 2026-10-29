import type { TableOverview } from '@picanteria/shared';
import { TABLE_STATUS_LABELS, TABLE_STATUS_STYLES } from './table-status';

/** Tarjeta de una mesa en el tablero; toda la tarjeta es el área táctil. */
export function TableCard({ table, onSelect }: { table: TableOverview; onSelect: (table: TableOverview) => void }) {
  const { order } = table;
  return (
    <button
      type="button"
      onClick={() => {
        onSelect(table);
      }}
      className={`touch-target flex min-h-32 flex-col items-start gap-1 rounded-2xl border-2 bg-card p-4 text-left active:bg-line ${TABLE_STATUS_STYLES[table.status]}`}
    >
      <span className="text-2xl font-bold text-ink">Mesa {table.tableNumber}</span>
      <span className="text-lg font-semibold">{TABLE_STATUS_LABELS[table.status]}</span>
      {order && (
        <span className="text-base text-muted">
          {order.waiter.fullName}
          {order.guestCount !== null && ` · ${order.guestCount} comensales`}
        </span>
      )}
    </button>
  );
}
