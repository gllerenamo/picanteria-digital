import type { OrderDetail } from '@picanteria/shared';

/** Consumo de la mesa: unidades vigentes de lo enviado, precio, subtotal y total en soles (FR-035). */
export function ConsumptionSummary({ order }: { order: OrderDetail }) {
  const lines = order.items.filter(
    (item) => item.status !== 'DRAFT' && item.status !== 'VOIDED' && item.activeQuantity > 0,
  );
  if (lines.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4" aria-label="Consumo">
      <h2 className="text-2xl font-bold">Consumo</h2>
      <table className="w-full text-lg">
        <thead className="sr-only">
          <tr>
            <th>Plato</th>
            <th>Precio</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((item) => (
            <tr key={item.id} className="border-b border-line">
              <td className="py-1">
                {item.activeQuantity} × {item.menuItem.name}
              </td>
              <td className="py-1 text-right text-muted">{item.unitPrice?.formatted}</td>
              <td className="py-1 text-right">{item.subtotal?.formatted}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="flex justify-between text-xl font-bold">
        <span>Total</span>
        <span>{order.consumption.total.formatted}</span>
      </p>
    </section>
  );
}
