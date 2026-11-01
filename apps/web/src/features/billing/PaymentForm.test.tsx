import type { CreatePaymentRequest } from '@picanteria/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaymentForm } from './PaymentForm';

function renderForm(onSubmit: (input: CreatePaymentRequest) => void = vi.fn()) {
  render(<PaymentForm defaultAmount={42.5} submitLabel="Cobrar" disabled={false} pending={false} error={null} onSubmit={onSubmit} />);
  return onSubmit;
}

describe('Feature 005 — formulario de pago', () => {
  it('propone el saldo y calcula el vuelto al escribir el monto recibido', async () => {
    renderForm();
    expect(screen.getByLabelText('Monto (S/)')).toHaveValue('42.50');
    expect(screen.getByText('Vuelto: —')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Monto recibido (S/)'), '50');

    expect(screen.getByText('Vuelto: S/ 7.50')).toBeInTheDocument();
  });

  it('"Referencia" solo aparece con Yape/Plin o tarjeta; el monto recibido solo en efectivo', async () => {
    renderForm();
    expect(screen.queryByLabelText('Referencia (opcional)')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Yape/Plin'));
    expect(screen.getByLabelText('Referencia (opcional)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Monto recibido (S/)')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Tarjeta'));
    expect(screen.getByLabelText('Referencia (opcional)')).toBeInTheDocument();
  });

  it('no envía un pago en efectivo si lo recibido no alcanza', async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText('Monto recibido (S/)'), '40');
    await userEvent.click(screen.getByRole('button', { name: 'Cobrar' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('El monto recibido no alcanza para cubrir el pago')).toBeInTheDocument();
  });

  it('envía el pago con tarjeta y su referencia', async () => {
    const onSubmit = renderForm();
    await userEvent.click(screen.getByText('Tarjeta'));
    await userEvent.type(screen.getByLabelText('Referencia (opcional)'), 'VOU-778');
    await userEvent.click(screen.getByRole('button', { name: 'Cobrar' }));

    expect(onSubmit).toHaveBeenCalledWith({ method: 'CARD', amount: 42.5, reference: 'VOU-778' });
  });
});
