import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Modal } from '../../components/Modal';
import { ApiError } from '../../lib/api-client';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { useAddItem, useCancelOpening, useOrder, useUpdateGuests } from './api';
import { DraftItems } from './DraftItems';
import { GuestCountStepper } from './GuestCountStepper';
import { MenuPicker, type NewItem } from './MenuPicker';
import { TABLE_STATUS_LABELS } from './table-status';
import { useOrdersRealtime } from './useOrdersRealtime';

const errorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/** Pedido de una mesa (/mozo/pedidos/:orderId): carta, ítems por enviar y acciones de mesa. */
export function OrderPage() {
  const { orderId = '' } = useParams();
  return <OrderView key={orderId} orderId={orderId} />;
}

function OrderView({ orderId }: { orderId: string }) {
  useOrdersRealtime();
  const navigate = useNavigate();
  const { data: order, isPending, isError } = useOrder(orderId);
  const updateGuests = useUpdateGuests(orderId);
  const cancelOpening = useCancelOpening(orderId);
  const addItem = useAddItem(orderId);
  const [editingGuests, setEditingGuests] = useState<number | null | undefined>(undefined);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (isPending) return <p className="text-lg text-muted">Cargando pedido…</p>;
  if (isError) return <p className="text-lg text-danger">No se pudo cargar el pedido.</p>;

  const { table } = order;
  const isOpen = order.status === 'OPEN';
  const drafts = order.items.filter((item) => item.status === 'DRAFT');

  const onAdd = (item: NewItem) => {
    setNotice(null);
    addItem.mutate(item, {
      onError: (error) => {
        setNotice(errorMessage(error));
      },
    });
  };
  return (
    <section className="flex flex-col gap-4">
      <Link to="/mozo" className="touch-target inline-flex items-center self-start text-lg font-medium text-brand underline">
        Volver a las mesas
      </Link>
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-3xl font-bold">Mesa {table.tableNumber}</h1>
        <span className="text-lg font-semibold">{TABLE_STATUS_LABELS[table.status]}</span>
        <span className="text-lg text-muted">Responsable: {order.waiter.fullName}</span>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-lg">
          Comensales: {order.guestCount === null ? 'sin indicar' : order.guestCount}
        </span>
        {order.status === 'OPEN' && (
          <button
            type="button"
            onClick={() => {
              setEditingGuests(order.guestCount);
            }}
            className="touch-target rounded-lg border border-line px-4 text-lg font-medium active:bg-line"
          >
            Cambiar comensales
          </button>
        )}
        {order.canCancel && (
          <button
            type="button"
            onClick={() => {
              setConfirmCancel(true);
            }}
            className="touch-target rounded-lg border border-danger px-4 text-lg font-medium text-danger active:bg-line"
          >
            Cancelar apertura
          </button>
        )}
      </div>

      {notice && (
        <p role="alert" className="rounded-lg border border-danger px-4 py-3 text-lg text-danger">
          {notice}
        </p>
      )}

      {/* En vertical, carta y pedido se apilan; en 1366 px van lado a lado. */}
      <div className="grid gap-6 lg:grid-cols-2">
        {isOpen && <MenuPicker onAdd={onAdd} pending={addItem.isPending} />}
        <div className="flex flex-col gap-6">
          {isOpen && <DraftItems items={drafts} />}
        </div>
      </div>

      {editingGuests !== undefined && (
        <Modal
          title="Comensales"
          onClose={() => {
            setEditingGuests(undefined);
          }}
        >
          <GuestCountStepper value={editingGuests} onChange={setEditingGuests} />
          {updateGuests.isError && <p className="mt-3 text-danger">{errorMessage(updateGuests.error)}</p>}
          <div className="flex justify-end gap-3 pt-6">
            <button
              type="button"
              onClick={() => {
                setEditingGuests(undefined);
              }}
              className="touch-target rounded-lg border border-line px-5 text-lg font-medium active:bg-line"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={updateGuests.isPending}
              onClick={() => {
                updateGuests.mutate(editingGuests, {
                  onSuccess: () => {
                    setEditingGuests(undefined);
                  },
                });
              }}
              className="touch-target rounded-lg bg-brand px-5 text-lg font-semibold text-white disabled:opacity-60"
            >
              Guardar
            </button>
          </div>
        </Modal>
      )}

      {confirmCancel && (
        <ConfirmDialog
          title="Cancelar apertura"
          message={`¿Cancelar la apertura de la mesa ${table.tableNumber}? Se descartará lo anotado.`}
          pending={cancelOpening.isPending}
          error={cancelOpening.isError ? errorMessage(cancelOpening.error) : null}
          onCancel={() => {
            setConfirmCancel(false);
          }}
          onConfirm={() => {
            cancelOpening.mutate(undefined, {
              onSuccess: () => {
                void navigate('/mozo');
              },
            });
          }}
        />
      )}
    </section>
  );
}
