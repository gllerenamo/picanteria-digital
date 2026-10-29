import { QUANTITY_MAX } from '@picanteria/shared';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Nombre del plato, para las etiquetas accesibles de los botones. */
  label: string;
  disabled?: boolean;
}

/** Cantidad de 1 a 99 con botones +/− de 44 px (FR-010). */
export function QuantityStepper({ value, onChange, label, disabled = false }: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={`Cantidad de ${label}`}>
      <button
        type="button"
        onClick={() => {
          onChange(value - 1);
        }}
        disabled={disabled || value <= 1}
        aria-label={`Menos ${label}`}
        className="touch-target rounded-lg border border-line text-2xl font-bold disabled:opacity-40"
      >
        −
      </button>
      <span className="min-w-8 text-center text-xl font-semibold" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => {
          onChange(value + 1);
        }}
        disabled={disabled || value >= QUANTITY_MAX}
        aria-label={`Más ${label}`}
        className="touch-target rounded-lg border border-line text-2xl font-bold disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
