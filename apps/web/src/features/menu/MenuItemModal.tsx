import { useState, type SyntheticEvent } from 'react';
import type { CategoryResponse, MenuItemResponse } from '@picanteria/shared';
import { Modal } from '../../components/Modal';
import { useCreateMenuItem, useUpdateMenuItem } from './api';

interface MenuItemModalProps {
  categories: CategoryResponse[];
  itemToEdit: MenuItemResponse | null;
  defaultCategoryId?: string;
  onClose: () => void;
}

export function MenuItemModal({
  categories,
  itemToEdit,
  defaultCategoryId,
  onClose,
}: MenuItemModalProps) {
  const isEditing = Boolean(itemToEdit);
  const [categoryId, setCategoryId] = useState(
    itemToEdit?.categoryId || defaultCategoryId || categories[0]?.id || '',
  );
  const [name, setName] = useState(itemToEdit?.name || '');
  const [description, setDescription] = useState(itemToEdit?.description || '');
  const [price, setPrice] = useState(itemToEdit ? itemToEdit.price.toString() : '');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateMenuItem();
  const updateMutation = useUpdateMenuItem();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const priceNum = parseFloat(price);
    if (!name.trim()) {
      setError('Ingresa el nombre del plato');
      return;
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('El precio debe ser un número mayor a cero');
      return;
    }
    if (!categoryId) {
      setError('Selecciona una categoría');
      return;
    }

    try {
      if (isEditing && itemToEdit) {
        await updateMutation.mutateAsync({
          id: itemToEdit.id,
          input: {
            categoryId,
            name: name.trim(),
            description: description.trim() || null,
            price: priceNum,
          },
        });
      } else {
        await createMutation.mutateAsync({
          categoryId,
          name: name.trim(),
          description: description.trim() || undefined,
          price: priceNum,
        });
      }
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error al guardar el plato');
      }
    }
  };

  return (
    <Modal title={isEditing ? 'Editar plato' : 'Nuevo plato'} onClose={onClose}>
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
          <label htmlFor="item-category" className="block text-sm font-medium">
            Categoría
          </label>
          <select
            id="item-category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
            }}
            disabled={isSubmitting}
            className="mt-1 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-base"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="item-name" className="block text-sm font-medium">
            Nombre del plato
          </label>
          <input
            id="item-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder="Ej. Rocoto Relleno"
            disabled={isSubmitting}
            className="mt-1 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-base"
          />
        </div>

        <div>
          <label htmlFor="item-price" className="block text-sm font-medium">
            Precio (S/)
          </label>
          <input
            id="item-price"
            type="number"
            step="0.50"
            min="0"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
            }}
            placeholder="28.00"
            disabled={isSubmitting}
            className="mt-1 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-base"
          />
        </div>

        <div>
          <label htmlFor="item-desc" className="block text-sm font-medium">
            Descripción (opcional)
          </label>
          <textarea
            id="item-desc"
            rows={2}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            placeholder="Ingredientes o detalles tradicionales"
            disabled={isSubmitting}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base"
          />
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            disabled={isSubmitting}
            className="min-h-[44px] rounded-lg border border-border px-4 py-2 font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] rounded-lg bg-primary px-5 py-2 font-medium text-white shadow"
          >
            {isSubmitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear plato'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
