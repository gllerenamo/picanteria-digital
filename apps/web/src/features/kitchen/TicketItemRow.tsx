import { ORDER_ITEM_STATUS_LABELS, type KitchenItemStatus, type TicketItem } from '@picanteria/shared';

/** Estado con texto además del color (contraste WCAG AA), igual que la vista del mozo. */
const STATUS_STYLES: Record<KitchenItemStatus, string> = {
  PENDING: 'border-ink text-ink',
  PREPARING: 'border-brand text-brand',
  READY: 'border-success text-success',
  VOIDED: 'border-danger text-danger',
};

const BUTTON = 'touch-target rounded-lg px-4 text-lg font-semibold disabled:opacity-60';

interface TicketItemRowProps {
  item: TicketItem;
  busy: boolean;
  onAdvance: (item: TicketItem) => void;
  onUndo: (item: TicketItem) => void;
}

/** Un plato de la comanda: un toque por paso y "Deshacer" (FR-008 a FR-011, FR-022, FR-023). */
export function TicketItemRow({ item, busy, onAdvance, onUndo }: TicketItemRowProps) {
  const voided = item.status === 'VOIDED';
  const label = `${voided ? item.quantity : item.toPrepare} × ${item.name}`;

  return (
    <li aria-label={label} className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`font-semibold ${voided ? 'text-muted line-through' : ''}`}>{label}</span>
        <span className={`rounded-full border-2 px-3 py-0.5 text-base font-semibold ${STATUS_STYLES[item.status]}`}>
          {voided ? 'ANULADO' : ORDER_ITEM_STATUS_LABELS[item.status]}
        </span>
      </div>
      {!voided && item.voidedQuantity > 0 && (
        <p className="font-semibold text-danger">
          {item.voidedQuantity} {item.voidedQuantity === 1 ? 'anulada' : 'anuladas'}
        </p>
      )}
      {item.notes && <p className="rounded-md bg-amber-50 px-3 py-1 font-bold text-amber-900">Nota: {item.notes}</p>}
      {!voided && (item.status !== 'READY' || item.canUndo) && (
        <div className="flex flex-wrap gap-2">
          {item.status === 'PENDING' && (
            <button type="button" disabled={busy} onClick={() => { onAdvance(item); }} className={`${BUTTON} bg-brand text-white active:bg-brand-dark`}>
              Preparar
            </button>
          )}
          {item.status === 'PREPARING' && (
            <button type="button" disabled={busy} onClick={() => { onAdvance(item); }} className={`${BUTTON} bg-success text-white`}>
              Listo
            </button>
          )}
          {item.canUndo && (
            <button type="button" disabled={busy} onClick={() => { onUndo(item); }} className={`${BUTTON} border border-line active:bg-line`}>
              Deshacer
            </button>
          )}
        </div>
      )}
    </li>
  );
}
