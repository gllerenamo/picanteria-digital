import type { OrderItemResponse } from '@picanteria/shared';
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { ApiError } from '../../lib/api-client';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { useRemoveItem, useUpdateItem } from './api';
import { NoteField } from './NoteField';
import { QuantityStepper } from './QuantityStepper';

const errorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/** Ítems por enviar: se cambian o se quitan sin pedir permiso (FR-012, AC-2.5, AC-2.6). */
export function DraftItems({ items }: { items: OrderItemResponse[] }) {
  const updateItem = useUpdateItem();
  const removeItem = useRemoveItem();
  const [editingNote, setEditingNote] = useState<{ item: OrderItemResponse; notes: string } | null>(null);
  const [removing, setRemoving] = useState<OrderItemResponse | null>(null);
  const error = updateItem.error ?? removeItem.error;

  return (
    <section className="flex flex-col gap-3" aria-label="Por enviar">
      <h2 className="text-2xl font-bold">Por enviar</h2>
      {items.length === 0 && <p className="text-lg text-muted">No hay ítems por enviar.</p>}
      {error && (
        <p role="alert" className="text-lg text-danger">
          {errorMessage(error)}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-line bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-lg font-semibold">{item.menuItem.name}</span>
              <span className="text-muted">{item.currentPrice?.formatted}</span>
            </div>
            {item.isAvailable === false && (
              <p className="font-semibold text-danger">No disponible: quítalo o cámbialo para enviar.</p>
            )}
            {item.notes && <p className="text-lg italic">“{item.notes}”</p>}
            <div className="flex flex-wrap items-center gap-3">
              <QuantityStepper
                value={item.quantity}
                label={item.menuItem.name}
                disabled={updateItem.isPending}
                onChange={(quantity) => {
                  updateItem.mutate({ itemId: item.id, input: { quantity } });
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setEditingNote({ item, notes: item.notes ?? '' });
                }}
                className="touch-target rounded-lg border border-line px-4 text-lg font-medium active:bg-line"
              >
                {item.notes ? 'Editar nota' : 'Agregar nota'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRemoving(item);
                }}
                className="touch-target rounded-lg border border-danger px-4 text-lg font-medium text-danger active:bg-line"
              >
                Quitar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editingNote && (
        <Modal
          title={`Nota de ${editingNote.item.menuItem.name}`}
          onClose={() => {
            setEditingNote(null);
          }}
        >
          <NoteField
            value={editingNote.notes}
            onChange={(notes) => {
              setEditingNote({ ...editingNote, notes });
            }}
          />
          <div className="flex justify-end gap-3 pt-6">
            <button
              type="button"
              onClick={() => {
                setEditingNote(null);
              }}
              className="touch-target rounded-lg border border-line px-5 text-lg font-medium active:bg-line"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={updateItem.isPending}
              onClick={() => {
                const notes = editingNote.notes.trim();
                updateItem.mutate(
                  { itemId: editingNote.item.id, input: { notes: notes === '' ? null : notes } },
                  {
                    onSuccess: () => {
                      setEditingNote(null);
                    },
                  },
                );
              }}
              className="touch-target rounded-lg bg-brand px-5 text-lg font-semibold text-white disabled:opacity-60"
            >
              Guardar
            </button>
          </div>
        </Modal>
      )}

      {removing && (
        <ConfirmDialog
          title="Quitar ítem"
          message={`¿Quitar ${String(removing.quantity)} × ${removing.menuItem.name} del pedido?`}
          pending={removeItem.isPending}
          error={removeItem.isError ? errorMessage(removeItem.error) : null}
          onCancel={() => {
            setRemoving(null);
          }}
          onConfirm={() => {
            removeItem.mutate(removing.id, {
              onSuccess: () => {
                setRemoving(null);
              },
            });
          }}
        />
      )}
    </section>
  );
}
