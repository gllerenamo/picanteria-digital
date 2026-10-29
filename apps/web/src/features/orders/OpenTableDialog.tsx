import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { GuestCountStepper } from './GuestCountStepper';

interface OpenTableDialogProps {
  tableNumber: number;
  pending: boolean;
  onConfirm: (guestCount: number | null) => void;
  onCancel: () => void;
}

/** Confirmación para abrir una mesa libre, con comensales opcionales. */
export function OpenTableDialog({ tableNumber, pending, onConfirm, onCancel }: OpenTableDialogProps) {
  const [guestCount, setGuestCount] = useState<number | null>(null);
  return (
    <Modal title={`¿Abrir la mesa ${tableNumber}?`} onClose={onCancel}>
      <p className="text-lg">Comensales (opcional)</p>
      <div className="mt-3">
        <GuestCountStepper value={guestCount} onChange={setGuestCount} />
      </div>
      <div className="flex flex-wrap justify-end gap-3 pt-6">
        <button
          type="button"
          onClick={onCancel}
          className="touch-target rounded-lg border border-line px-5 text-lg font-medium active:bg-line"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm(guestCount);
          }}
          disabled={pending}
          className="touch-target rounded-lg bg-brand px-5 text-lg font-semibold text-white disabled:opacity-60"
        >
          Abrir mesa
        </button>
      </div>
    </Modal>
  );
}
