import { ROLES, ROLE_LABELS } from '@picanteria/shared';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { ApiError } from '../../lib/api-client';

const inputClass =
  'touch-target h-12 w-full rounded-lg border border-line px-3 text-lg focus:border-brand focus:outline-2 focus:outline-brand';

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="text-base text-danger">
      {message}
    </p>
  );
}

interface FieldProps {
  id: string;
  label: string;
  error: string | undefined;
}

export function TextField({ id, label, error, ...input }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-medium">
        {label}
      </label>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={`${id}-error`} className={inputClass} {...input} />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function RoleSelect({ id, label, error, ...select }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-medium">
        {label}
      </label>
      <select id={id} aria-invalid={Boolean(error)} aria-describedby={`${id}-error`} className={inputClass} {...select}>
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** Mensaje general de error de la API que no corresponde a un campo concreto. */
export function FormAlert({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-lg bg-red-50 p-3 text-base text-danger" role="alert">
      {children}
    </p>
  );
}

export function FormActions({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="touch-target rounded-lg border border-line px-5 text-lg font-medium active:bg-line"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-lg bg-brand px-5 text-lg font-semibold text-white active:bg-brand-dark disabled:opacity-60"
      >
        {pending ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  );
}

/** Errores de la API por campo (`details` de VALIDATION_ERROR). */
export function apiFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR' || !error.details) return {};
  return Object.fromEntries(
    Object.entries(error.details).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}
