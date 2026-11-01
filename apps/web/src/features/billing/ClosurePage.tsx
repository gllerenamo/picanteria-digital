import {
  CLOSURE_NOTES_MAX,
  CLOSURE_NOTES_MIN,
  closureCountsSchema,
  type ClosureCounts,
  type ClosureSummary,
} from '@picanteria/shared';
import { useId, useState, type SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { ApiError } from '../../lib/api-client';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { TextField } from '../users/form-fields';
import { useConfirmClosure, usePreviewClosure } from './api';
import { ClosureLinesTable } from './ClosureLinesTable';
import { CASHIER_OFFLINE_MESSAGE, type CashierNotice } from './messages';
import { parseAmount } from './money';

const FIELDS = [
  { key: 'countedCash', label: 'Efectivo (S/)' },
  { key: 'countedYapePlin', label: 'Yape/Plin (S/)' },
  { key: 'countedCard', label: 'Tarjeta (S/)' },
] as const;

type CountField = (typeof FIELDS)[number]['key'];

const errorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/** Mesas que impiden el cierre (`details.tables` de CLOSURE_OPEN_TABLES, AC-3.5). */
function openTables(error: unknown): number[] {
  if (!(error instanceof ApiError) || error.code !== 'CLOSURE_OPEN_TABLES') return [];
  const tables = error.details?.tables;
  return Array.isArray(tables) ? tables.filter((value): value is number => typeof value === 'number') : [];
}

/**
 * Cierre del día (/caja/cierre): primero lo contado, a ciegas; después lo registrado y las
 * diferencias, con observación obligatoria si hay alguna (FR-016 a FR-020).
 */
export function ClosurePage() {
  const navigate = useNavigate();
  const preview = usePreviewClosure();
  const confirmClosure = useConfirmClosure();
  const notesId = useId();
  const [text, setText] = useState<Record<CountField, string>>({ countedCash: '', countedYapePlin: '', countedCard: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<ClosureCounts | null>(null);
  const [summary, setSummary] = useState<ClosureSummary | null>(null);
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const blocked = openTables(preview.error ?? confirmClosure.error);

  const onCompare = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = closureCountsSchema.safeParse({
      countedCash: parseAmount(text.countedCash) ?? undefined,
      countedYapePlin: parseAmount(text.countedYapePlin) ?? undefined,
      countedCard: parseAmount(text.countedCard) ?? undefined,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) errors[issue.path.join('.')] ??= issue.message;
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    preview.mutate(result.data, {
      onSuccess: (data) => {
        setCounts(result.data);
        setSummary(data);
      },
    });
  };

  const onConfirmClick = () => {
    const trimmed = notes.trim();
    if (summary?.hasDifferences && trimmed.length < CLOSURE_NOTES_MIN) {
      setNotesError('Explica las diferencias en la observación antes de cerrar');
      return;
    }
    setNotesError(null);
    setConfirming(true);
  };

  const onConfirm = () => {
    if (!counts) return;
    const trimmed = notes.trim();
    confirmClosure.mutate(
      { ...counts, ...(trimmed ? { notes: trimmed } : {}) },
      {
        onSuccess: () => {
          const state: CashierNotice = { notice: 'Cierre guardado.' };
          void navigate('/caja/cierres', { state });
        },
        onSettled: () => {
          setConfirming(false);
        },
      },
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <Link to="/caja" className="touch-target inline-flex items-center self-start text-lg font-medium text-brand underline">
        Volver a caja
      </Link>
      <h1 className="text-3xl font-bold">Cierre del día</h1>
      <ConnectionBanner message={CASHIER_OFFLINE_MESSAGE} />

      {blocked.length > 0 && (
        <div role="alert" className="rounded-lg border-2 border-danger bg-card px-4 py-3 text-lg text-danger">
          <p className="font-semibold">No puedes cerrar con mesas abiertas</p>
          <p>Mesas abiertas: {blocked.map((table) => `Mesa ${String(table)}`).join(', ')}</p>
        </div>
      )}

      {!summary ? (
        <form onSubmit={onCompare} className="flex max-w-xl flex-col gap-4 rounded-lg border border-line bg-card p-4" aria-label="Montos contados" noValidate>
          <h2 className="text-2xl font-bold">Montos contados</h2>
          <p className="text-lg text-muted">Cuenta el dinero de cada método e ingrésalo. Después verás lo registrado en el sistema.</p>
          {FIELDS.map((field) => (
            <TextField
              key={field.key}
              id={`${notesId}-${field.key}`}
              label={field.label}
              inputMode="decimal"
              value={text[field.key]}
              onChange={(event) => {
                setText({ ...text, [field.key]: event.target.value });
              }}
              error={fieldErrors[field.key]}
            />
          ))}
          {preview.isError && blocked.length === 0 && (
            <p role="alert" className="text-lg text-danger">
              {errorMessage(preview.error)}
            </p>
          )}
          <button type="submit" disabled={preview.isPending} className="touch-target rounded-lg bg-brand px-5 py-2 text-xl font-semibold text-white disabled:opacity-50">
            Ver diferencias
          </button>
        </form>
      ) : (
        <div className="flex max-w-2xl flex-col gap-4 rounded-lg border border-line bg-card p-4">
          <h2 className="text-2xl font-bold">Diferencias</h2>
          <ClosureLinesTable lines={summary.lines} />
          <dl className="flex flex-col gap-1 text-xl">
            <div className="flex justify-between font-bold">
              <dt>Total del día</dt>
              <dd>{summary.total.formatted}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Cuentas cobradas</dt>
              <dd>{summary.accountsCount}</dd>
            </div>
          </dl>
          <div className="flex flex-col gap-1">
            <label htmlFor={notesId} className="text-lg font-medium">
              {summary.hasDifferences ? 'Observación (obligatoria)' : 'Observación (opcional)'}
            </label>
            <textarea
              id={notesId}
              value={notes}
              maxLength={CLOSURE_NOTES_MAX}
              rows={3}
              aria-invalid={Boolean(notesError)}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
              className="min-h-11 rounded-lg border border-line px-3 py-2 text-lg"
            />
            {notesError && <p className="text-base text-danger">{notesError}</p>}
          </div>
          {confirmClosure.isError && blocked.length === 0 && (
            <p role="alert" className="text-lg text-danger">
              {errorMessage(confirmClosure.error)}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setSummary(null);
                preview.reset();
              }}
              className="touch-target rounded-lg border border-line px-5 text-lg font-medium active:bg-line"
            >
              Corregir montos
            </button>
            <button type="button" onClick={onConfirmClick} className="touch-target rounded-lg bg-brand px-5 text-xl font-semibold text-white">
              Confirmar cierre
            </button>
          </div>
        </div>
      )}

      {confirming && summary && (
        <ConfirmDialog
          title="Confirmar cierre"
          message={`Se guardará el cierre con ${summary.total.formatted} registrados en ${String(summary.accountsCount)} cuentas. Los cobros siguientes serán de la próxima jornada.`}
          pending={confirmClosure.isPending}
          error={null}
          onConfirm={onConfirm}
          onCancel={() => {
            setConfirming(false);
          }}
        />
      )}
    </section>
  );
}
