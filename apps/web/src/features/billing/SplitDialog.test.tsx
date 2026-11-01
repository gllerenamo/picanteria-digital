import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ACCOUNT_ID, accountDetail, accountItem, billPart, money } from '../../../tests/msw/billing-handlers';
import { server } from '../../../tests/msw/server';
import { renderNavigableRoutes } from '../../../tests/render';
import { SplitDialog } from './SplitDialog';

/** Cuenta de S/ 100.00: 2 Ceviche a S/ 30.00 y 1 Chupe a S/ 40.00. */
const hundred = () =>
  accountDetail({
    items: [
      accountItem(1, { menuItem: { id: accountItem(1).menuItem.id, name: 'Ceviche' }, quantity: 2, price: 30 }),
      accountItem(2, { menuItem: { id: accountItem(2).menuItem.id, name: 'Chupe' }, quantity: 1, price: 40 }),
    ],
    total: money(100),
    pending: money(100),
  });

function renderDialog(account = hundred(), onClose = vi.fn()) {
  renderNavigableRoutes([{ path: '/', element: <SplitDialog account={account} onClose={onClose} /> }], '/');
  return onClose;
}

describe('Feature 005 — dividir la cuenta', () => {
  it('"Partes iguales" muestra el monto de cada parte con los céntimos sobrantes en la primera', async () => {
    renderDialog();
    const amounts = () => within(screen.getByRole('list', { name: 'Montos por parte' })).getAllByRole('listitem').map((item) => item.textContent);

    expect(amounts()).toEqual(['Parte 1S/ 50.00', 'Parte 2S/ 50.00']);
    await userEvent.click(screen.getByRole('button', { name: 'Más personas' }));
    expect(amounts()).toEqual(['Parte 1S/ 33.34', 'Parte 2S/ 33.33', 'Parte 3S/ 33.33']);
  });

  it('"Por ítems" cuenta las unidades sin asignar y no deja confirmar hasta asignarlas todas', async () => {
    let body: unknown = null;
    server.use(
      http.post(`*/api/billing/accounts/${ACCOUNT_ID}/split`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(hundred());
      }),
    );
    const onClose = renderDialog();

    await userEvent.click(screen.getByRole('tab', { name: 'Por ítems' }));
    expect(screen.getByText('Unidades sin asignar: 3')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Confirmar división' });
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Agregar Ceviche a la parte 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agregar Ceviche a la parte 1' }));
    expect(screen.getByText('Unidades sin asignar: 1')).toBeInTheDocument();
    expect(screen.getByText('Parte 1 · S/ 60.00')).toBeInTheDocument();
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Agregar Chupe a la parte 2' }));
    expect(screen.getByText('Unidades sin asignar: 0')).toBeInTheDocument();
    await userEvent.click(confirm);

    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(body).toEqual({
      mode: 'BY_ITEMS',
      parts: [
        { items: [{ orderItemId: accountItem(1).orderItemId, units: 2 }] },
        { items: [{ orderItemId: accountItem(2).orderItemId, units: 1 }] },
      ],
    });
  });

  it('al rehacer una división por ítems desactualizada, parte de lo asignado y deja sin asignar solo lo nuevo', () => {
    const account = hundred();
    account.items.push(accountItem(3, { menuItem: { id: accountItem(3).menuItem.id, name: 'Chicha' }, quantity: 1, price: 6.5 }));
    account.split = {
      id: 'b1110000-0000-4000-8000-000000000001',
      mode: 'BY_ITEMS',
      isStale: true,
      parts: [
        billPart(1, { amount: money(60), pending: money(60), items: [{ orderItemId: accountItem(1).orderItemId, name: 'Ceviche', units: 2 }] }),
        billPart(2, { amount: money(40), pending: money(40), items: [{ orderItemId: accountItem(2).orderItemId, name: 'Chupe', units: 1 }] }),
      ],
    };
    renderDialog(account);

    expect(screen.getByRole('tab', { name: 'Por ítems' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Unidades sin asignar: 1')).toBeInTheDocument();
    expect(screen.getByText('Parte 1 · S/ 60.00')).toBeInTheDocument();
  });
});
