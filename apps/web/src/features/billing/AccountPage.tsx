import { PAYMENT_METHOD_LABELS, type AccountDetail, type BillPart, type CreatePaymentRequest, type Payment } from '@picanteria/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { ApiError } from '../../lib/api-client';
import { TABLE_STATUS_LABELS } from '../orders/table-status';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { useAccount, useCloseWithoutCharge, useCreatePayment } from './api';
import { formatDateTime } from './money';
import { CASHIER_OFFLINE_MESSAGE, type CashierNotice } from './messages';
import { PaymentForm } from './PaymentForm';
import { SplitDialog } from './SplitDialog';
import { useBillingRealtime } from './useBillingRealtime';
import { VoidPaymentDialog } from './VoidPaymentDialog';

const errorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/** Cuenta de una mesa (/caja/cuentas/:orderId): detalle, división y pagos (US1, US2). */
export function AccountPage() {
  const { orderId = '' } = useParams();
  return <AccountView key={orderId} orderId={orderId} />;
}

function AccountView({ orderId }: { orderId: string }) {
  useBillingRealtime();
  const navigate = useNavigate();
  const { data: account, isPending, isError } = useAccount(orderId);
  const createPayment = useCreatePayment(orderId);
  const closeWithoutCharge = useCloseWithoutCharge(orderId);
  /** Parte elegida con "Cobrar esta parte". */
  const [partId, setPartId] = useState<string | null>(null);
  /** Pago que liberaría la mesa: espera la confirmación (FR-028). */
  const [confirming, setConfirming] = useState<CreatePaymentRequest | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [voiding, setVoiding] = useState<Payment | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  if (isPending) return <p className="text-lg text-muted">Cargando cuenta…</p>;
  if (isError) return <p className="text-lg text-danger">No se pudo cargar la cuenta.</p>;

  const { table } = account;
  const isOpen = account.orderStatus === 'OPEN';
  const reopened = isOpen && table.status === 'OCUPADA';
  const split = account.split;
  const selectedPart = split && !split.isStale ? (split.parts.find((part) => part.id === partId) ?? null) : null;
  const leaveWhenPaid = (result: AccountDetail) => {
    if (result.orderStatus === 'PAID') {
      const state: CashierNotice = { notice: `Cuenta pagada. La mesa ${String(table.tableNumber)} quedó libre.` };
      void navigate('/caja', { state });
    }
  };

  const sendPayment = (input: CreatePaymentRequest) => {
    setPaymentError(null);
    createPayment.mutate(input, {
      onSuccess: (result) => {
        setConfirming(null);
        setPartId(null);
        leaveWhenPaid(result);
      },
      onError: (error) => {
        setConfirming(null);
        setPaymentError(errorMessage(error));
      },
    });
  };

  const onPay = (input: CreatePaymentRequest) => {
    // Cobrar todo el saldo libera la mesa: se pide confirmación.
    if (Math.round(input.amount * 100) === Math.round(account.pending.amount * 100)) {
      setConfirming(input);
    } else {
      sendPayment(input);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <Link to="/caja" className="touch-target inline-flex items-center self-start text-lg font-medium text-brand underline">
        Volver a caja
      </Link>
      <ConnectionBanner message={CASHIER_OFFLINE_MESSAGE} />
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-3xl font-bold">Mesa {table.tableNumber}</h1>
        <span className="text-lg font-semibold">{isOpen ? TABLE_STATUS_LABELS[table.status] : 'Pagada'}</span>
        <span className="text-lg text-muted">Mozo: {account.waiter.fullName}</span>
      </header>

      {reopened && (
        <p role="alert" className="rounded-lg border-2 border-danger bg-card px-4 py-3 text-lg font-semibold text-danger">
          El mozo agregó pedidos. Espera a que vuelva a pedir la cuenta.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <AccountItems account={account} />
          <PaymentsList
            payments={account.payments}
            canVoid={isOpen}
            onVoid={(payment) => {
              setVoiding(payment);
            }}
          />
        </div>

        <div className="flex flex-col gap-4">
          {split && (
            <SplitParts
              parts={split.parts}
              isStale={split.isStale}
              canCharge={account.canCharge}
              selectedId={selectedPart?.id ?? null}
              onSelect={(part) => {
                setPaymentError(null);
                setPartId(part.id);
              }}
            />
          )}

          {isOpen && !reopened && (split?.isStale || account.canCharge) && (
            <button
              type="button"
              onClick={() => {
                setSplitting(true);
              }}
              className="touch-target rounded-lg border-2 border-brand bg-card px-5 text-lg font-semibold text-brand active:bg-line"
            >
              {split?.isStale ? 'Volver a dividir' : 'Dividir cuenta'}
            </button>
          )}

          {account.canCloseWithoutCharge && (
            <button
              type="button"
              onClick={() => {
                setConfirmClose(true);
              }}
              className="touch-target rounded-lg bg-brand px-5 text-xl font-semibold text-white"
            >
              Cerrar sin cobro
            </button>
          )}

          {isOpen && account.pending.amount > 0 && (!split || selectedPart) && (
            <section className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4" aria-label="Cobro">
              <h2 className="text-2xl font-bold">{selectedPart ? `Cobrar ${selectedPart.label}` : 'Cobrar'}</h2>
              <PaymentForm
                key={`${selectedPart?.id ?? 'total'}-${String(account.pending.amount)}`}
                defaultAmount={selectedPart ? selectedPart.pending.amount : account.pending.amount}
                {...(selectedPart ? { partId: selectedPart.id } : {})}
                submitLabel="Cobrar"
                disabled={!account.canCharge}
                pending={createPayment.isPending}
                error={paymentError}
                onSubmit={onPay}
              />
            </section>
          )}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Cobrar y liberar la mesa"
          message={`Se registrará el pago de S/ ${confirming.amount.toFixed(2)} (${PAYMENT_METHOD_LABELS[confirming.method]}) y la mesa ${String(table.tableNumber)} quedará libre.`}
          pending={createPayment.isPending}
          error={null}
          onConfirm={() => {
            sendPayment(confirming);
          }}
          onCancel={() => {
            setConfirming(null);
          }}
        />
      )}
      {confirmClose && (
        <ConfirmDialog
          title="Cerrar sin cobro"
          message={`La cuenta no tiene saldo. La mesa ${String(table.tableNumber)} quedará libre.`}
          pending={closeWithoutCharge.isPending}
          error={closeWithoutCharge.isError ? errorMessage(closeWithoutCharge.error) : null}
          onConfirm={() => {
            closeWithoutCharge.mutate(undefined, { onSuccess: leaveWhenPaid });
          }}
          onCancel={() => {
            setConfirmClose(false);
          }}
        />
      )}
      {splitting && (
        <SplitDialog
          account={account}
          onClose={() => {
            setSplitting(false);
            setPartId(null);
          }}
        />
      )}
      {voiding && (
        <VoidPaymentDialog
          orderId={orderId}
          payment={voiding}
          onClose={() => {
            setVoiding(null);
          }}
        />
      )}
    </section>
  );
}

/** Ítems enviados: unidades vigentes con su subtotal y las anuladas tachadas, sin sumar (AC-1.2). */
function AccountItems({ account }: { account: AccountDetail }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4" aria-label="Cuenta">
      <h2 className="text-2xl font-bold">Cuenta</h2>
      <table className="w-full text-lg">
        <thead>
          <tr className="border-b border-line text-left text-base text-muted">
            <th className="py-1 font-medium">Plato</th>
            <th className="py-1 text-right font-medium">Precio</th>
            <th className="py-1 text-right font-medium">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {account.items.flatMap((item) => [
            item.activeQuantity > 0 && (
              <tr key={item.orderItemId} className="border-b border-line">
                <td className="py-1">
                  {item.activeQuantity} × {item.menuItem.name}
                </td>
                <td className="py-1 text-right text-muted">{item.unitPrice.formatted}</td>
                <td className="py-1 text-right">{item.subtotal.formatted}</td>
              </tr>
            ),
            item.voidedQuantity > 0 && (
              <tr key={`${item.orderItemId}-anulado`} className="border-b border-line text-muted">
                <td className="py-1">
                  <span className="line-through">
                    {item.voidedQuantity} × {item.menuItem.name}
                  </span>{' '}
                  <span className="rounded bg-line px-2 text-base font-semibold text-danger">Anulado</span>
                </td>
                <td className="py-1 text-right line-through">{item.unitPrice.formatted}</td>
                <td className="py-1 text-right">—</td>
              </tr>
            ),
          ])}
        </tbody>
      </table>
      <dl className="flex flex-col gap-1 text-xl">
        <div className="flex justify-between font-bold">
          <dt>Total</dt>
          <dd>{account.total.formatted}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Pagado</dt>
          <dd>{account.paid.formatted}</dd>
        </div>
        <div className="flex justify-between font-bold">
          <dt>Saldo</dt>
          <dd>{account.pending.formatted}</dd>
        </div>
      </dl>
    </section>
  );
}

function PaymentsList({ payments, canVoid, onVoid }: { payments: Payment[]; canVoid: boolean; onVoid: (payment: Payment) => void }) {
  if (payments.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4" aria-label="Pagos">
      <h2 className="text-2xl font-bold">Pagos</h2>
      <ul className="flex flex-col gap-2">
        {payments.map((payment) => (
          <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <div className={`flex flex-col ${payment.status === 'VOIDED' ? 'text-muted' : ''}`}>
              <span className={`text-lg font-semibold ${payment.status === 'VOIDED' ? 'line-through' : ''}`}>
                {PAYMENT_METHOD_LABELS[payment.method]} · {payment.amount.formatted}
              </span>
              <span className="text-base text-muted">
                {formatDateTime(payment.paidAt)} · {payment.cashier.fullName}
                {payment.reference ? ` · Ref. ${payment.reference}` : ''}
                {payment.changeAmount ? ` · Vuelto ${payment.changeAmount.formatted}` : ''}
              </span>
              {payment.status === 'VOIDED' && (
                <span className="text-base text-danger">
                  Anulado por {payment.voidedBy?.fullName ?? '—'}: {payment.voidReason}
                </span>
              )}
            </div>
            {canVoid && payment.status === 'VALID' && (
              <button
                type="button"
                onClick={() => {
                  onVoid(payment);
                }}
                className="touch-target rounded-lg border border-danger px-4 text-lg font-medium text-danger active:bg-line"
              >
                Anular
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface SplitPartsProps {
  parts: BillPart[];
  isStale: boolean;
  canCharge: boolean;
  selectedId: string | null;
  onSelect: (part: BillPart) => void;
}

/** Partes de la división vigente con su estado (AC-2.3); avisa si quedó desactualizada (AC-2.6). */
function SplitParts({ parts, isStale, canCharge, selectedId, onSelect }: SplitPartsProps) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4" aria-label="Partes">
      <h2 className="text-2xl font-bold">Partes</h2>
      {isStale && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-lg text-danger">
          La cuenta cambió desde que se dividió. Vuelve a dividir el saldo antes de cobrar.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {parts.map((part) => {
          const paid = part.pending.amount === 0;
          return (
            <li
              key={part.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 p-3 ${
                selectedId === part.id ? 'border-brand' : 'border-line'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-lg font-semibold">
                  {part.label} · {part.amount.formatted}
                </span>
                {part.items.length > 0 && (
                  <span className="text-base text-muted">
                    {part.items.map((item) => `${String(item.units)} × ${item.name}`).join(', ')}
                  </span>
                )}
                <span className={`text-base font-semibold ${paid ? 'text-success' : ''}`}>
                  {paid ? 'Pagada' : `Falta ${part.pending.formatted}`}
                </span>
              </div>
              {!paid && !isStale && (
                <button
                  type="button"
                  disabled={!canCharge}
                  onClick={() => {
                    onSelect(part);
                  }}
                  className="touch-target rounded-lg bg-brand px-4 text-lg font-semibold text-white disabled:opacity-50"
                >
                  Cobrar esta parte
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
