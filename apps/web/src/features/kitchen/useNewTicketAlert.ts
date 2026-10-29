import type { KitchenBoard } from '@picanteria/shared';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { playTone } from './sound';

/** Segundos que una comanda nueva se ve resaltada (FR-003). */
const HIGHLIGHT_MS = 10_000;

/** IDs que no estaban en la consulta anterior; en la primera carga no hay llegadas. */
function arrivals(seen: RefObject<Set<string> | null>, ids: readonly string[]): string[] {
  const known = seen.current;
  if (known === null) {
    seen.current = new Set(ids);
    return [];
  }
  const fresh = ids.filter((id) => !known.has(id));
  for (const id of fresh) known.add(id);
  return fresh;
}

/**
 * Comandas nuevas y anulaciones nuevas suenan una vez (salvo "Silenciar"); las comandas nuevas
 * además se resaltan 10 s (FR-003, FR-027). Devuelve los envíos resaltados.
 */
export function useNewTicketAlert(board: KitchenBoard | undefined, muted: boolean): ReadonlySet<string> {
  const mutedRef = useRef(muted);
  const seenTickets = useRef<Set<string> | null>(null);
  const seenVoids = useRef<Set<string> | null>(null);
  const timers = useRef<number[]>([]);
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    mutedRef.current = muted;
  });

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!board) return;
    const newTickets = arrivals(
      seenTickets,
      board.active.map((ticket) => ticket.dispatchId),
    );
    const newVoids = arrivals(
      seenVoids,
      board.voidNotices.map((notice) => notice.itemVoidId),
    );
    if ((newTickets.length > 0 || newVoids.length > 0) && !mutedRef.current) playTone();
    if (newTickets.length === 0) return;

    setHighlighted((current) => new Set([...current, ...newTickets]));
    timers.current.push(
      window.setTimeout(() => {
        setHighlighted((current) => new Set([...current].filter((id) => !newTickets.includes(id))));
      }, HIGHLIGHT_MS),
    );
  }, [board]);

  return highlighted;
}
