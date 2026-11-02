import { PAYMENT_METHOD_LABELS, VOID_PAYMENT_REASON_MAX, VOID_PAYMENT_REASON_MIN, type Payment } from '@picanteria/shared';
import { useId, useState } from 'react';
import { Modal } from '../../components/Modal';
import { ApiError } from '../../lib/api-client';
import { useVoidPayment } from './api';

/** "Anular pago": motivo obligatorio y confirmación (FR-014, FR-028, AC-2.7). */
export function VoidPaymentDialog({ orderId, payment, onClose }: { orderId: string; payment: Payment; onClose: () => void }) {
  const voidPayment = useVoidPayment(orderId);
  const [reason, setReason] = useState('');
  const reasonId = useId();
  const valid = reason.trim().length >= VOID_PAYMENT_REASON_MIN;

  return (
    <Modal title="Anular pago" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-lg">
          {PAYMENT_METHOD_LABELS[payment.method]} · {payment.amount.formatted}. El pago dejará de contar para el saldo y
          para el cierre.
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor={reasonId} className="text-lg font-medium">
            Motivo (obligatorio)
          </label>
          <textarea
            id={reasonId}
            value={reason}
            maxLength={VOID_PAYMENT_REASON_MAX}
            rows={2}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            className="min-h-11 rounded-lg border border-line px-3 py-2 text-lg"
          />
        </div>
        {voidPayment.isError && (
          <p role="alert" className="text-lg text-danger">
            {voidPayment.error instanceof ApiError ? voidPayment.error.message : 'No se pudo anular. Inténtalo de nuevo.'}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-3 pt-6">
        <button
          type="button"
          onClick={onClose}
          className="touch-target rounded-lg border border-line px-5 text-lg font-medium active:bg-line"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!valid || voidPayment.isPending}
          onClick={() => {
            voidPayment.mutate({ paymentId: payment.id, reason: reason.trim() }, { onSuccess: onClose });
          }}
          className="touch-target rounded-lg bg-danger px-5 text-lg font-semibold text-white disabled:opacity-50"
        >
          Confirmar anulación
        </button>
      </div>
    </Modal>
  );
}
