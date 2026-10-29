import { Modal } from '../../components/Modal';
import { FormAlert } from './form-fields';

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
  /** Mensaje en español si la acción falló (por ejemplo, LAST_ADMIN). */
  error: string | null;
}

/** Confirmación de acciones destructivas (FR-022, Principio IV). */
export function ConfirmDialog({ title, message, onConfirm, onCancel, pending, error }: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-lg">{message}</p>
      <div className="mt-4">
        <FormAlert>{error}</FormAlert>
      </div>
      <div className="flex flex-wrap justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="touch-target rounded-lg border border-line px-5 text-lg font-medium active:bg-line"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="touch-target rounded-lg bg-danger px-5 text-lg font-semibold text-white disabled:opacity-60"
        >
          Confirmar
        </button>
      </div>
    </Modal>
  );
}
