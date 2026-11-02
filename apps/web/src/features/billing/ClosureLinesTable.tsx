import { PAYMENT_METHOD_LABELS, type ClosureLine } from '@picanteria/shared';
import { formatSoles } from './money';

/** Diferencia con texto y color: sobrante en verde, faltante en rojo (nunca solo color). */
function Difference({ amount }: { amount: number }) {
  const cents = Math.round(amount * 100);
  if (cents === 0) return <span>{formatSoles(0)}</span>;
  return cents > 0 ? (
    <span className="font-semibold text-success">Sobrante {formatSoles(cents)}</span>
  ) : (
    <span className="font-semibold text-danger">Faltante {formatSoles(-cents)}</span>
  );
}

/** Registrado / Contado / Diferencia por método (FR-017, AC-3.2). */
export function ClosureLinesTable({ lines }: { lines: ClosureLine[] }) {
  return (
    <table className="w-full text-lg">
      <thead>
        <tr className="border-b border-line text-left text-base text-muted">
          <th className="py-1 font-medium">Método</th>
          <th className="py-1 text-right font-medium">Registrado</th>
          <th className="py-1 text-right font-medium">Contado</th>
          <th className="py-1 text-right font-medium">Diferencia</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.method} className="border-b border-line">
            <td className="py-1">{PAYMENT_METHOD_LABELS[line.method]}</td>
            <td className="py-1 text-right">{line.expected.formatted}</td>
            <td className="py-1 text-right">{line.counted.formatted}</td>
            <td className="py-1 text-right">
              <Difference amount={line.difference.amount} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
