import type { MenuItemResponse } from '@picanteria/shared';
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useMenuForOrder } from './api';
import { NoteField } from './NoteField';
import { QuantityStepper } from './QuantityStepper';

export interface NewItem {
  menuItemId: string;
  quantity: number;
  notes: string | null;
}

/** Carta con solo los platos y bebidas disponibles, por categoría (FR-009, AC-2.1, AC-2.2). */
export function MenuPicker({ onAdd, pending }: { onAdd: (item: NewItem) => void; pending: boolean }) {
  const { data: categories, isPending, isError } = useMenuForOrder();
  const [selected, setSelected] = useState<MenuItemResponse | null>(null);

  return (
    <section className="flex flex-col gap-3" aria-label="Carta">
      <h2 className="text-2xl font-bold">Carta</h2>
      {isPending && <p className="text-lg text-muted">Cargando carta…</p>}
      {isError && <p className="text-lg text-danger">No se pudo cargar la carta.</p>}
      {categories?.map((category) =>
        category.items.length === 0 ? null : (
          <div key={category.id} className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-muted">{category.name}</h3>
            <ul className="flex flex-col gap-2">
              {category.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(item);
                    }}
                    className="touch-target flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-card px-4 py-2 text-left text-lg active:bg-line"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted">{item.priceFormatted}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
      {selected && (
        <AddItemDialog
          item={selected}
          pending={pending}
          onCancel={() => {
            setSelected(null);
          }}
          onConfirm={(quantity, notes) => {
            onAdd({ menuItemId: selected.id, quantity, notes });
            setSelected(null);
          }}
        />
      )}
    </section>
  );
}

interface AddItemDialogProps {
  item: MenuItemResponse;
  pending: boolean;
  onConfirm: (quantity: number, notes: string | null) => void;
  onCancel: () => void;
}

function AddItemDialog({ item, pending, onConfirm, onCancel }: AddItemDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  return (
    <Modal title={item.name} onClose={onCancel}>
      <p className="text-lg text-muted">{item.priceFormatted}</p>
      <div className="mt-4 flex flex-col gap-4">
        <QuantityStepper value={quantity} onChange={setQuantity} label={item.name} />
        <NoteField value={notes} onChange={setNotes} />
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
          disabled={pending}
          onClick={() => {
            onConfirm(quantity, notes.trim() === '' ? null : notes.trim());
          }}
          className="touch-target rounded-lg bg-brand px-5 text-lg font-semibold text-white disabled:opacity-60"
        >
          Agregar
        </button>
      </div>
    </Modal>
  );
}
