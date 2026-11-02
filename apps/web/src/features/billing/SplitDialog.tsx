import { SPLIT_PARTS_MAX, SPLIT_PARTS_MIN, type AccountDetail, type CreateSplitRequest } from '@picanteria/shared';
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { ApiError } from '../../lib/api-client';
import { useCreateSplit } from './api';
import { formatSoles } from './money';

type Mode = CreateSplitRequest['mode'];

/** Mismo reparto que el servidor: ⌊saldo / n⌋ y los céntimos sobrantes a la parte 1 (AC-2.1). */
function splitEqually(pendingCents: number, parts: number): number[] {
  const base = Math.floor(pendingCents / parts);
  return Array.from({ length: parts }, (_, index) => (index === 0 ? pendingCents - base * (parts - 1) : base));
}

interface AvailableItem {
  orderItemId: string;
  name: string;
  units: number;
  unitPriceCents: number;
}

/** Asignación por parte: unidades de cada ítem. */
type Assignment = Array<Record<string, number>>;

const clampParts = (value: number): number => Math.min(SPLIT_PARTS_MAX, Math.max(SPLIT_PARTS_MIN, value));

/**
 * Asignación inicial: en una división por ítems desactualizada se parte de las asignaciones de
 * las partes no pagadas y solo quedan sin asignar las unidades nuevas (research.md §6).
 */
function initialAssignment(account: AccountDetail, available: AvailableItem[]): Assignment {
  const previous = account.split?.mode === 'BY_ITEMS' ? account.split.parts.filter((part) => part.pending.amount > 0) : [];
  const left = new Map(available.map((item) => [item.orderItemId, item.units]));
  const parts: Assignment = previous.map((part) => {
    const units: Record<string, number> = {};
    for (const item of part.items) {
      const free = left.get(item.orderItemId) ?? 0;
      const taken = Math.min(free, item.units);
      if (taken > 0) {
        units[item.orderItemId] = (units[item.orderItemId] ?? 0) + taken;
        left.set(item.orderItemId, free - taken);
      }
    }
    return units;
  });
  while (parts.length < SPLIT_PARTS_MIN) parts.push({});
  return parts.slice(0, SPLIT_PARTS_MAX);
}

/** "Dividir cuenta": en partes iguales o por ítems, sobre el saldo pendiente (FR-011). */
export function SplitDialog({ account, onClose }: { account: AccountDetail; onClose: () => void }) {
  const createSplit = useCreateSplit(account.orderId);
  const pendingCents = Math.round(account.pending.amount * 100);
  const available: AvailableItem[] = account.items
    .map((item) => ({
      orderItemId: item.orderItemId,
      name: item.menuItem.name,
      units: item.activeQuantity - item.paidUnits,
      unitPriceCents: Math.round(item.unitPrice.amount * 100),
    }))
    .filter((item) => item.units > 0);

  const [mode, setMode] = useState<Mode>(account.split?.mode ?? 'EQUAL');
  const [people, setPeople] = useState(2);
  const [assignment, setAssignment] = useState<Assignment>(() => initialAssignment(account, available));
  const [localError, setLocalError] = useState<string | null>(null);

  const assignedOf = (orderItemId: string): number => assignment.reduce((sum, part) => sum + (part[orderItemId] ?? 0), 0);
  const unassigned = available.reduce((sum, item) => sum + item.units - assignedOf(item.orderItemId), 0);
  const partAmount = (part: Record<string, number>): number =>
    available.reduce((sum, item) => sum + (part[item.orderItemId] ?? 0) * item.unitPriceCents, 0);

  const changeUnits = (partIndex: number, orderItemId: string, delta: number) => {
    setAssignment(assignment.map((part, index) => (index === partIndex ? { ...part, [orderItemId]: (part[orderItemId] ?? 0) + delta } : part)));
  };
  const resizeParts = (count: number) => {
    const next = assignment.slice(0, count);
    while (next.length < count) next.push({});
    setAssignment(next);
  };

  const confirm = () => {
    setLocalError(null);
    let input: CreateSplitRequest;
    if (mode === 'EQUAL') {
      input = { mode: 'EQUAL', parts: people };
    } else {
      const parts = assignment.map((part) => ({
        items: Object.entries(part)
          .filter(([, units]) => units > 0)
          .map(([orderItemId, units]) => ({ orderItemId, units })),
      }));
      if (parts.some((part) => part.items.length === 0)) {
        setLocalError('Cada parte debe tener al menos un ítem');
        return;
      }
      input = { mode: 'BY_ITEMS', parts };
    }
    createSplit.mutate(input, { onSuccess: onClose });
  };

  const tabClass = (active: boolean) =>
    `touch-target flex-1 rounded-lg px-4 text-lg font-semibold ${active ? 'bg-brand text-white' : 'border border-line bg-card'}`;
  const stepClass = 'touch-target rounded-lg border border-line text-2xl font-bold disabled:opacity-40';

  return (
    <Modal title="Dividir cuenta" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-lg">Saldo a dividir: {account.pending.formatted}</p>
        <div role="tablist" aria-label="Forma de dividir" className="flex gap-2">
          <button type="button" role="tab" aria-selected={mode === 'EQUAL'} className={tabClass(mode === 'EQUAL')} onClick={() => { setMode('EQUAL'); }}>
            Partes iguales
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'BY_ITEMS'}
            className={tabClass(mode === 'BY_ITEMS')}
            onClick={() => {
              setMode('BY_ITEMS');
            }}
          >
            Por ítems
          </button>
        </div>

        {mode === 'EQUAL' ? (
          <div role="tabpanel" aria-label="Partes iguales" className="flex flex-col gap-3">
            <div className="flex items-center gap-3" role="group" aria-label="Cantidad de personas">
              <button type="button" aria-label="Menos personas" className={stepClass} disabled={people <= SPLIT_PARTS_MIN} onClick={() => { setPeople(clampParts(people - 1)); }}>
                −
              </button>
              <span className="text-lg font-semibold" aria-live="polite">
                {people} personas
              </span>
              <button type="button" aria-label="Más personas" className={stepClass} disabled={people >= SPLIT_PARTS_MAX} onClick={() => { setPeople(clampParts(people + 1)); }}>
                +
              </button>
            </div>
            <ul className="flex flex-col gap-1 text-lg" aria-label="Montos por parte">
              {splitEqually(pendingCents, people).map((amount, index) => (
                <li key={index} className="flex justify-between border-b border-line py-1">
                  <span>Parte {index + 1}</span>
                  <span>{formatSoles(amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div role="tabpanel" aria-label="Por ítems" className="flex flex-col gap-3">
            <div className="flex items-center gap-3" role="group" aria-label="Cantidad de partes">
              <button type="button" aria-label="Menos partes" className={stepClass} disabled={assignment.length <= SPLIT_PARTS_MIN} onClick={() => { resizeParts(assignment.length - 1); }}>
                −
              </button>
              <span className="text-lg font-semibold">{assignment.length} partes</span>
              <button type="button" aria-label="Más partes" className={stepClass} disabled={assignment.length >= SPLIT_PARTS_MAX} onClick={() => { resizeParts(assignment.length + 1); }}>
                +
              </button>
            </div>
            <p className={`text-lg font-semibold ${unassigned > 0 ? 'text-danger' : 'text-success'}`} aria-live="polite">
              Unidades sin asignar: {unassigned}
            </p>
            {assignment.map((part, partIndex) => (
              <fieldset key={partIndex} className="flex flex-col gap-2 rounded-lg border border-line p-3">
                <legend className="px-1 text-lg font-semibold">
                  Parte {partIndex + 1} · {formatSoles(partAmount(part))}
                </legend>
                {available.map((item) => {
                  const units = part[item.orderItemId] ?? 0;
                  const free = item.units - assignedOf(item.orderItemId);
                  return (
                    <div key={item.orderItemId} className="flex items-center justify-between gap-2">
                      <span className="text-base">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Quitar ${item.name} de la parte ${String(partIndex + 1)}`}
                          className={stepClass}
                          disabled={units <= 0}
                          onClick={() => {
                            changeUnits(partIndex, item.orderItemId, -1);
                          }}
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-lg font-semibold">{units}</span>
                        <button
                          type="button"
                          aria-label={`Agregar ${item.name} a la parte ${String(partIndex + 1)}`}
                          className={stepClass}
                          disabled={free <= 0}
                          onClick={() => {
                            changeUnits(partIndex, item.orderItemId, 1);
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </fieldset>
            ))}
          </div>
        )}

        {(localError ?? createSplit.isError) && (
          <p role="alert" className="text-lg text-danger">
            {localError ??
              (createSplit.error instanceof ApiError ? createSplit.error.message : 'No se pudo dividir. Inténtalo de nuevo.')}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-3 pt-6">
        <button type="button" onClick={onClose} className="touch-target rounded-lg border border-line px-5 text-lg font-medium active:bg-line">
          Cancelar
        </button>
        <button
          type="button"
          disabled={createSplit.isPending || (mode === 'BY_ITEMS' && unassigned > 0)}
          onClick={confirm}
          className="touch-target rounded-lg bg-brand px-5 text-lg font-semibold text-white disabled:opacity-50"
        >
          Confirmar división
        </button>
      </div>
    </Modal>
  );
}
