import type { Ticket, TicketItem } from '@picanteria/shared';
import { TicketCard } from './TicketCard';

interface CompletedSectionProps {
  tickets: readonly Ticket[];
  now: number;
  busy: boolean;
  onAdvance: (item: TicketItem) => void;
  onUndo: (item: TicketItem) => void;
}

/** Comandas completadas en los últimos 30 minutos, con su tiempo total (FR-013, FR-021). */
export function CompletedSection({ tickets, ...actions }: CompletedSectionProps) {
  if (tickets.length === 0) return null;
  return (
    <section aria-label="Completadas" className="flex flex-col gap-3">
      <h2 className="text-2xl font-bold">Completadas</h2>
      <ul className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {tickets.map((ticket) => (
          <li key={ticket.dispatchId} className="flex flex-col">
            <TicketCard ticket={ticket} {...actions} />
          </li>
        ))}
      </ul>
    </section>
  );
}
