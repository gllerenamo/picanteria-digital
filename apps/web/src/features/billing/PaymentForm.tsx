import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_REFERENCE_MAX,
  createPaymentSchema,
  type CreatePaymentRequest,
  type PaymentMethod,
} from '@picanteria/shared';
import { useId, useState, type SyntheticEvent } from 'react';
import { TextField } from '../users/form-fields';
import { formatSoles, parseAmount } from './money';

interface PaymentFormProps {
  /** Monto por defecto: el saldo o lo que falta de la parte (en soles). */
  defaultAmount: number;
  /** Parte que se cobra, si la cuenta está dividida. */
  partId?: string;
  submitLabel: string;
  disabled: boolean;
  pending: boolean;
  /** Mensaje en español si la API rechazó el pago. */
  error: string | null;
  onSubmit: (input: CreatePaymentRequest) => void;
}

/**
 * Formulario de pago: método, monto, monto recibido y vuelto (solo efectivo) y referencia (solo
 * Yape/Plin y tarjeta) (FR-005, FR-006).
 */
export function PaymentForm({ defaultAmount, partId, submitLabel, disabled, pending, error, onSubmit }: PaymentFormProps) {
  const id = useId();
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState(defaultAmount.toFixed(2));
  const [received, setReceived] = useState('');
  const [reference, setReference] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const amountValue = parseAmount(amount);
  const receivedValue = parseAmount(received);
  const change =
    method === 'CASH' && amountValue !== null && receivedValue !== null
      ? Math.round(receivedValue * 100) - Math.round(amountValue * 100)
      : null;

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const candidate = {
      method,
      amount: amountValue ?? Number.NaN,
      ...(method === 'CASH' ? { receivedAmount: receivedValue ?? undefined } : {}),
      ...(method !== 'CASH' && reference.trim() !== '' ? { reference: reference.trim() } : {}),
      ...(partId ? { partId } : {}),
    };
    const result = createPaymentSchema.safeParse(candidate);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) errors[issue.path.join('.')] ??= issue.message;
      setFieldErrors(errors);
      return;
    }
    if (method === 'CASH' && change !== null && change < 0) {
      setFieldErrors({ receivedAmount: 'El monto recibido no alcanza para cubrir el pago' });
      return;
    }
    setFieldErrors({});
    onSubmit(result.data);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Registrar pago" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-base font-medium">Método</legend>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((option) => (
            <label
              key={option}
              className={`touch-target inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 text-lg font-medium ${
                method === option ? 'border-brand bg-brand text-white' : 'border-line bg-card'
              }`}
            >
              <input
                type="radio"
                name={`${id}-method`}
                value={option}
                checked={method === option}
                onChange={() => {
                  setMethod(option);
                  setFieldErrors({});
                }}
                className="sr-only"
              />
              {PAYMENT_METHOD_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <TextField
        id={`${id}-amount`}
        label="Monto (S/)"
        inputMode="decimal"
        value={amount}
        onChange={(event) => {
          setAmount(event.target.value);
        }}
        error={fieldErrors.amount}
      />

      {method === 'CASH' ? (
        <>
          <TextField
            id={`${id}-received`}
            label="Monto recibido (S/)"
            inputMode="decimal"
            value={received}
            onChange={(event) => {
              setReceived(event.target.value);
            }}
            error={fieldErrors.receivedAmount}
          />
          <p className="text-xl font-semibold" aria-live="polite">
            Vuelto: {change !== null && change >= 0 ? formatSoles(change) : '—'}
          </p>
        </>
      ) : (
        <TextField
          id={`${id}-reference`}
          label="Referencia (opcional)"
          maxLength={PAYMENT_REFERENCE_MAX}
          value={reference}
          onChange={(event) => {
            setReference(event.target.value);
          }}
          error={fieldErrors.reference}
        />
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-base text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={disabled || pending}
        className="touch-target rounded-lg bg-brand px-5 py-2 text-xl font-semibold text-white disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
