import { useState, type SyntheticEvent } from 'react';
import { Modal } from '../../components/Modal';
import { useCreateCategory } from './api';

interface CategoryModalProps {
  onClose: () => void;
  nextOrder: number;
}

export function CategoryModal({ onClose, nextOrder }: CategoryModalProps) {
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState(nextOrder.toString());
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateCategory();
  const isSubmitting = createMutation.isPending;

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Ingresa el nombre de la categoría');
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        sortOrder: parseInt(sortOrder, 10) || nextOrder,
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error al guardar la categoría');
      }
    }
  };

  return (
    <Modal title="Nueva categoría" onClose={onClose}>
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="flex flex-col gap-4"
      >
        {error && (
          <div role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="cat-name" className="block text-sm font-medium">
            Nombre de la categoría
          </label>
          <input
            id="cat-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder="Ej. Entradas, Fondos, Bebidas"
            disabled={isSubmitting}
            className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-background px-3 py-2 text-base"
          />
        </div>

        <div>
          <label htmlFor="cat-order" className="block text-sm font-medium">
            Orden de visualización
          </label>
          <input
            id="cat-order"
            type="number"
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value);
            }}
            disabled={isSubmitting}
            className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-background px-3 py-2 text-base"
          />
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            disabled={isSubmitting}
            className="min-h-[44px] rounded-lg border border-line px-4 py-2 font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] rounded-lg bg-brand px-5 py-2 font-medium text-white shadow"
          >
            {isSubmitting ? 'Guardando...' : 'Crear categoría'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
