import { GUEST_COUNT_MAX, GUEST_COUNT_MIN } from '@picanteria/shared';

/** Comensales opcionales con botones +/− de 44 px (FR-004); `null` = sin indicar. */
export function GuestCountStepper({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  const decrease = () => {
    onChange(value === null || value <= GUEST_COUNT_MIN ? null : value - 1);
  };
  const increase = () => {
    onChange(value === null ? GUEST_COUNT_MIN : Math.min(value + 1, GUEST_COUNT_MAX));
  };
  return (
    <div className="flex items-center gap-3" role="group" aria-label="Comensales">
      <button
        type="button"
        onClick={decrease}
        disabled={value === null}
        aria-label="Menos comensales"
        className="touch-target rounded-lg border border-line text-2xl font-bold disabled:opacity-40"
      >
        −
      </button>
      <span className="min-w-24 text-center text-lg font-semibold" aria-live="polite">
        {value === null ? 'Sin indicar' : `${value} comensales`}
      </span>
      <button
        type="button"
        onClick={increase}
        disabled={value === GUEST_COUNT_MAX}
        aria-label="Más comensales"
        className="touch-target rounded-lg border border-line text-2xl font-bold disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
