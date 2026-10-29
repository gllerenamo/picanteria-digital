import type { OrderItemResponse } from '@picanteria/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { Modal } from '../../components/Modal';
import { ApiError } from '../../lib/api-client';
import { useCurrentUser } from '../auth/session';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { useAddItem, useCancelOpening, useOrder, useRequestBill, useSendToKitchen, useUpdateGuests } from './api';
import { ConsumptionSummary } from './ConsumptionSummary';
import { DraftItems } from './DraftItems';
import { GuestCountStepper } from './GuestCountStepper';
import { MenuPicker, type NewItem } from './MenuPicker';
import { hasPendingKey } from './pending-dispatch';
import { SentItems } from './SentItems';
import { TABLE_STATUS_LABELS } from './table-status';
import { useOrdersRealtime } from './useOrdersRealtime';
import { VoidItemDialog } from './VoidItemDialog';

const errorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/** Sin conexión, el envío no salió y los ítems siguen por enviar (AC-3.8). */
const sendErrorMessage = (error: unknown): string =>
  error instanceof ApiError && error.code === 'NETWORK_ERROR'
    ? 'No se pudo enviar: no hay conexión. Tus ítems siguen por enviar.'
    : errorMessage(error);

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
  const sendToKitchen = useSendToKitchen(orderId);
  const requestBill = useRequestBill(orderId);
  const [confirmBill, setConfirmBill] = useState(false);
  /** Ítem que se quiso agregar con la mesa por cobrar: espera la confirmación de reapertura. */
  const [pendingReopen, setPendingReopen] = useState<NewItem | null>(null);
  const [editingGuests, setEditingGuests] = useState<number | null | undefined>(undefined);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [voiding, setVoiding] = useState<OrderItemResponse | null>(null);
  const { data: user } = useCurrentUser();
  const isAdmin = user?.role === 'ADMIN';

  if (isPending) return <p className="text-lg text-muted">Cargando pedido…</p>;
  if (isError) return <p className="text-lg text-danger">No se pudo cargar el pedido.</p>;

  const { table } = order;
  const isOpen = order.status === 'OPEN';
  const drafts = order.items.filter((item) => item.status === 'DRAFT');

  const onAdd = (item: NewItem, confirmReopen = false) => {
    setNotice(null);
    addItem.mutate(
      { ...item, confirmReopen },
      {
        onSuccess: () => {
          setPendingReopen(null);
        },
        onError: (error) => {
          // Mesa por cobrar: se pide confirmación para volver a abrirla (FR-034, AC-6.7).
          if (error instanceof ApiError && error.code === 'TABLE_AWAITING_PAYMENT') {
            setPendingReopen(item);
          } else {
            setPendingReopen(null);
            setNotice(errorMessage(error));
          }
        },
      },
    );
  };

  const onSend = () => {
    setSendResult(null);
    sendToKitchen.mutate(undefined, {
      onSuccess: (dispatch) => {
        setSendResult({ ok: true, text: `Ronda ${String(dispatch.round)} enviada a cocina` });
      },
      onError: (error) => {
        setSendResult({ ok: false, text: sendErrorMessage(error) });
      },
    });
  };
  return (
    <section className="flex flex-col gap-4">
      <Link to="/mozo" className="touch-target inline-flex items-center self-start text-lg font-medium text-brand underline">
        Volver a las mesas
      </Link>
      <ConnectionBanner />
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
          {isOpen && (
            <div className="flex flex-col gap-2">
              {/* Un solo toque para enviar (Principio IV); deshabilitado sin ítems nuevos (AC-3.4). */}
              <button
                type="button"
                onClick={onSend}
                disabled={drafts.length === 0 || sendToKitchen.isPending}
                className="touch-target rounded-lg bg-brand px-5 py-3 text-xl font-bold text-white disabled:opacity-50"
              >
                {hasPendingKey(orderId) ? 'Reintentar' : 'Enviar a cocina'}
              </button>
              {sendResult && (
                <p
                  role={sendResult.ok ? 'status' : 'alert'}
                  className={`text-lg font-semibold ${sendResult.ok ? 'text-success' : 'text-danger'}`}
                >
                  {sendResult.text}
                </p>
              )}
            </div>
          )}
          <SentItems order={order} onVoid={isAdmin && isOpen ? setVoiding : undefined} />
          <ConsumptionSummary order={order} />
          {/* Sin acción para liberar la mesa: solo Caja la libera al cobrar (AC-6.5). */}
          {isOpen && table.status === 'OCUPADA' && (
            <button
              type="button"
              onClick={() => {
                setConfirmBill(true);
              }}
              className="touch-target rounded-lg border-2 border-ink px-5 py-3 text-xl font-bold active:bg-line"
            >
              Pedir la cuenta
            </button>
          )}
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

      {confirmBill && (
        <ConfirmDialog
          title="Pedir la cuenta"
          message={`¿Pedir la cuenta de la mesa ${String(table.tableNumber)}?`}
          pending={requestBill.isPending}
          error={requestBill.isError ? errorMessage(requestBill.error) : null}
          onCancel={() => {
            setConfirmBill(false);
            requestBill.reset();
          }}
          onConfirm={() => {
            requestBill.mutate(undefined, {
              onSuccess: () => {
                setConfirmBill(false);
              },
            });
          }}
        />
      )}

      {pendingReopen && (
        <ConfirmDialog
          title="Mesa por cobrar"
          message="La mesa está por cobrar. ¿Volver a abrirla para agregar?"
          pending={addItem.isPending}
          error={null}
          onCancel={() => {
            setPendingReopen(null);
          }}
          onConfirm={() => {
            onAdd(pendingReopen, true);
          }}
        />
      )}

      {voiding && (
        <VoidItemDialog
          item={voiding}
          onClose={() => {
            setVoiding(null);
          }}
        />
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
