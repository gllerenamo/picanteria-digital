import { ORDER_ITEM_STATUS_LABELS, type OrderDetail, type OrderItemResponse, type OrderItemStatus } from '@picanteria/shared';

/** Estado con texto además del color (contraste WCAG AA). */
const STATUS_STYLES: Record<OrderItemStatus, string> = {
  DRAFT: 'border-line text-muted',
  PENDING: 'border-ink text-ink',
  PREPARING: 'border-brand text-brand',
  READY: 'border-success text-success',
  VOIDED: 'border-line text-muted line-through',
};

const timeFormat = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' });

interface SentItemsProps {
  order: OrderDetail;
  /** Solo el administrador anula ítems pendientes o en preparación (Historia 5). */
  onVoid?: (item: OrderItemResponse) => void;
}

/** Ítems enviados por ronda, con su estado en cocina (FR-014, FR-026, AC-4.1). */
export function SentItems({ order, onVoid }: SentItemsProps) {
  const rounds = order.dispatches.map((dispatch) => ({
    dispatch,
    items: order.items.filter((item) => item.dispatchId === dispatch.id),
  }));
  if (rounds.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-label="Enviado">
      <h2 className="text-2xl font-bold">Enviado</h2>
      {rounds.map(({ dispatch, items }) => (
        <div key={dispatch.id} className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-muted">
            Ronda {dispatch.round} · {timeFormat.format(new Date(dispatch.sentAt))} · {dispatch.sentBy.fullName}
          </h3>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 rounded-lg border border-line bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-lg font-semibold">
                    {item.quantity} × {item.menuItem.name}
                  </span>
                  <span className={`rounded-full border-2 px-3 py-1 font-semibold ${STATUS_STYLES[item.status]}`}>
                    {ORDER_ITEM_STATUS_LABELS[item.status]}
                  </span>
                </div>
                {item.notes && <p className="text-lg italic">“{item.notes}”</p>}
                {item.voids.map((itemVoid) => (
                  <p key={itemVoid.id} className="text-danger">
                    {itemVoid.units} {itemVoid.units === 1 ? 'anulada' : 'anuladas'}: {itemVoid.reason}
                  </p>
                ))}
                {onVoid && (item.status === 'PENDING' || item.status === 'PREPARING') && item.activeQuantity > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onVoid(item);
                    }}
                    className="touch-target self-start rounded-lg border border-danger px-4 text-lg font-medium text-danger active:bg-line"
                  >
                    Anular
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
