import type { Ticket, TicketItem } from '@picanteria/shared';
import { minutesBetween, WaitBadge } from './WaitBadge';
import { TicketItemRow } from './TicketItemRow';

const timeFormat = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' });

/** "Mesa 5" o "Mesa 3 · 2.ª ronda" (FR-004). */
export function tableLabel(ticket: Pick<Ticket, 'tableNumber' | 'round'>): string {
  return ticket.round > 1 ? `Mesa ${ticket.tableNumber} · ${ticket.round}.ª ronda` : `Mesa ${ticket.tableNumber}`;
}

interface TicketCardProps {
  ticket: Ticket;
  now: number;
  isNew?: boolean;
  busy: boolean;
  onAdvance: (item: TicketItem) => void;
  onUndo: (item: TicketItem) => void;
}

/** Una comanda: número de envío, mesa, mozo, hora, espera y sus platos (FR-002, AC-1.4). */
export function TicketCard({ ticket, now, isNew = false, busy, onAdvance, onUndo }: TicketCardProps) {
  const border = isNew ? 'border-brand ring-4 ring-brand/30' : ticket.state === 'VOIDED' ? 'border-danger' : 'border-line';

  return (
    <article aria-label={`Comanda N.º ${ticket.sequence}`} className={`flex flex-col gap-3 rounded-2xl border-2 bg-card p-4 ${border}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-2xl font-bold">
            N.º {ticket.sequence} · {tableLabel(ticket)}
          </p>
          <p className="text-muted">
            {ticket.sentBy.fullName} · {timeFormat.format(new Date(ticket.sentAt))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isNew && <span className="rounded-full bg-brand px-3 py-1 font-semibold text-white">Nueva</span>}
          {ticket.state === 'ACTIVE' && <WaitBadge sentAt={ticket.sentAt} now={now} />}
          {ticket.state === 'VOIDED' && (
            <span className="rounded-full border-2 border-danger px-3 py-1 font-semibold text-danger">Comanda anulada</span>
          )}
          {ticket.state === 'COMPLETED' && ticket.completedAt && (
            <span className="rounded-full border-2 border-success px-3 py-1 font-semibold text-success">
              Tomó {minutesBetween(ticket.sentAt, Date.parse(ticket.completedAt))} min
            </span>
          )}
        </div>
      </header>
      <ul className="flex flex-col gap-3">
        {ticket.items.map((item) => (
          <TicketItemRow key={item.id} item={item} busy={busy} onAdvance={onAdvance} onUndo={onUndo} />
        ))}
      </ul>
    </article>
  );
}
