import type { OrderItemResponse } from '@picanteria/shared';
import { useId, useState } from 'react';
import { Modal } from '../../components/Modal';
import { ApiError } from '../../lib/api-client';
import { useVoidItem } from './api';

const REASON_MIN = 3;
const REASON_MAX = 200;

/**
 * Anulación por el administrador: unidades (todas por defecto) y motivo obligatorio, con
 * confirmación (FR-029, AC-5.3, AC-5.7).
 */
export function VoidItemDialog({ item, onClose }: { item: OrderItemResponse; onClose: () => void }) {
  const voidItem = useVoidItem();
  const [units, setUnits] = useState(item.activeQuantity);
  const [reason, setReason] = useState('');
  const reasonId = useId();
  const valid = reason.trim().length >= REASON_MIN;

  return (
    <Modal title={`Anular ${item.menuItem.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3" role="group" aria-label="Unidades a anular">
          <button
            type="button"
            onClick={() => {
              setUnits(units - 1);
            }}
            disabled={units <= 1}
            aria-label="Menos unidades"
            className="touch-target rounded-lg border border-line text-2xl font-bold disabled:opacity-40"
          >
            −
          </button>
          <span className="text-lg font-semibold" aria-live="polite">
            {units} de {item.activeQuantity}
          </span>
          <button
            type="button"
            onClick={() => {
              setUnits(units + 1);
            }}
            disabled={units >= item.activeQuantity}
            aria-label="Más unidades"
            className="touch-target rounded-lg border border-line text-2xl font-bold disabled:opacity-40"
          >
            +
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={reasonId} className="text-lg font-medium">
            Motivo (obligatorio)
          </label>
          <textarea
            id={reasonId}
            value={reason}
            maxLength={REASON_MAX}
            rows={2}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            className="min-h-11 rounded-lg border border-line px-3 py-2 text-lg"
          />
        </div>
        {voidItem.isError && (
          <p role="alert" className="text-lg text-danger">
            {voidItem.error instanceof ApiError ? voidItem.error.message : 'No se pudo anular. Inténtalo de nuevo.'}
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
          disabled={!valid || voidItem.isPending}
          onClick={() => {
            voidItem.mutate({ itemId: item.id, input: { units, reason: reason.trim() } }, { onSuccess: onClose });
          }}
          className="touch-target rounded-lg bg-danger px-5 text-lg font-semibold text-white disabled:opacity-50"
        >
          Anular
        </button>
      </div>
    </Modal>
  );
}
