import { ORDER_ITEM_STATUS_LABELS, type TicketItem } from '@picanteria/shared';
import { useState } from 'react';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { Modal } from '../../components/Modal';
import { ApiError } from '../../lib/api-client';
import { useAcknowledgeVoid, useAdvanceItem, useKitchenBoard, useKitchenRealtime, useUndoItem } from './api';
import { CompletedSection } from './CompletedSection';
import { useSoundSettings } from './sound';
import { TicketCard } from './TicketCard';
import { useNewTicketAlert } from './useNewTicketAlert';
import { useServerNow } from './useServerClock';
import { VoidNoticesBar } from './VoidNoticesBar';

const PREVIOUS_STATUS = { PREPARING: 'PENDING', READY: 'PREPARING' } as const;

/** Pantalla de comandas de la cocina (/cocina), pensada para tablet (specs/004-cocina). */
export function KitchenBoardPage() {
  useKitchenRealtime();
  const { data: board, isPending, isError } = useKitchenBoard();
  const sound = useSoundSettings();
  const highlighted = useNewTicketAlert(board, sound.muted);
  const now = useServerNow(board?.serverTime);
  const advance = useAdvanceItem();
  const undo = useUndoItem();
  const acknowledge = useAcknowledgeVoid();
  const [confirmUndo, setConfirmUndo] = useState<TicketItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = advance.isPending || undo.isPending;

  const onError = (error: Error) => {
    setNotice(error instanceof ApiError ? error.message : 'No se pudo guardar el cambio. Inténtalo de nuevo.');
  };

  const onAdvance = (item: TicketItem) => {
    if (item.status !== 'PENDING' && item.status !== 'PREPARING') return;
    setNotice(null);
    advance.mutate({ itemId: item.id, from: item.status }, { onError });
  };

  const onConfirmUndo = () => {
    const item = confirmUndo;
    setConfirmUndo(null);
    if (item?.status !== 'PREPARING' && item?.status !== 'READY') return;
    setNotice(null);
    undo.mutate({ itemId: item.id, from: item.status }, { onError });
  };

  const actions = { now, busy, onAdvance, onUndo: setConfirmUndo };

  return (
    <section className="flex flex-col gap-4 text-kitchen">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Cocina</h1>
        <div className="flex flex-wrap gap-2">
          {sound.blocked && !sound.muted && (
            <button type="button" onClick={sound.unlock} className="touch-target rounded-lg bg-brand px-4 font-semibold text-white">
              Toca para activar el sonido
            </button>
          )}
          <button
            type="button"
            aria-pressed={sound.muted}
            onClick={sound.toggleMuted}
            className="touch-target rounded-lg border border-line px-4 font-medium active:bg-line"
          >
            {sound.muted ? 'Activar sonido' : 'Silenciar'}
          </button>
        </div>
      </div>
      <ConnectionBanner message="Sin conexión — los pedidos nuevos no se están recibiendo." />
      {notice && (
        <p role="alert" className="rounded-lg border border-danger px-4 py-3 text-danger">
          {notice}
        </p>
      )}
      {board && (
        <VoidNoticesBar
          notices={board.voidNotices}
          busy={acknowledge.isPending}
          onAcknowledge={(voidNotice) => {
            acknowledge.mutate(voidNotice.itemVoidId, { onError });
          }}
        />
      )}
      {isPending && <p className="text-muted">Cargando comandas…</p>}
      {isError && <p className="text-danger">No se pudieron cargar las comandas.</p>}
      {board &&
        (board.active.length === 0 ? (
          <p className="rounded-lg border border-line bg-card px-4 py-6 text-center text-muted">No hay pedidos pendientes</p>
        ) : (
          <ol aria-label="Comandas" className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {board.active.map((ticket) => (
              <li key={ticket.dispatchId} className="flex flex-col">
                <TicketCard ticket={ticket} isNew={highlighted.has(ticket.dispatchId)} {...actions} />
              </li>
            ))}
          </ol>
        ))}
      {board && <CompletedSection tickets={board.completed} {...actions} />}
      {confirmUndo && (confirmUndo.status === 'PREPARING' || confirmUndo.status === 'READY') && (
        <Modal
          title="¿Deshacer el último cambio?"
          onClose={() => {
            setConfirmUndo(null);
          }}
        >
          <p className="text-lg">
            {confirmUndo.toPrepare} × {confirmUndo.name} volverá a “{ORDER_ITEM_STATUS_LABELS[PREVIOUS_STATUS[confirmUndo.status]]}”.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setConfirmUndo(null);
              }}
              className="touch-target rounded-lg border border-line px-4 text-lg font-medium active:bg-line"
            >
              Cancelar
            </button>
            <button type="button" onClick={onConfirmUndo} className="touch-target rounded-lg bg-brand px-4 text-lg font-semibold text-white">
              Deshacer
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
