import type { AccountDetail } from '@picanteria/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_ID, accountDetail, mockAccount, money, payment } from '../../../tests/msw/billing-handlers';
import { server } from '../../../tests/msw/server';
import { fakeRealtime } from '../../../tests/realtime';
import { renderNavigableRoutes } from '../../../tests/render';
import { RealtimeProvider } from '../../lib/realtime-context';
import { AccountPage } from './AccountPage';
import { PendingAccountsPage } from './PendingAccountsPage';

function renderAccount() {
  const realtime = fakeRealtime();
  const view = renderNavigableRoutes(
    [
      {
        path: '/caja/cuentas/:orderId',
        element: (
          <RealtimeProvider value={realtime.state}>
            <AccountPage />
          </RealtimeProvider>
        ),
      },
      {
        path: '/caja',
        element: (
          <RealtimeProvider value={realtime.state}>
            <PendingAccountsPage />
          </RealtimeProvider>
        ),
      },
    ],
    `/caja/cuentas/${ACCOUNT_ID}`,
  );
  return { realtime, view };
}

describe('Feature 005 — cuenta de la mesa (/caja/cuentas/:orderId)', () => {
  it('muestra los ítems anulados con la etiqueta "Anulado" sin sumar al total', async () => {
    mockAccount(accountDetail());
    renderAccount();

    const table = within(await screen.findByRole('region', { name: 'Cuenta' }));
    expect(table.getByText('2 × Rocoto Relleno')).toBeInTheDocument();
    expect(table.getByText('S/ 56.00', { selector: 'td' })).toBeInTheDocument();
    expect(table.getByText('1 × Rocoto Relleno').closest('tr')).toHaveTextContent('Anulado');
    expect(table.getByText('2 × Chicha Morada').closest('tr')).toHaveTextContent('Anulado');
    expect(table.getByText('Total').nextSibling).toHaveTextContent('S/ 56.00');
    expect(table.getByText('Saldo').nextSibling).toHaveTextContent('S/ 56.00');
  });

  it('cobrar el saldo completo pide confirmación, envía la clave de idempotencia y vuelve a caja', async () => {
    let account: AccountDetail = accountDetail();
    mockAccount(() => account);
    server.use(http.get('*/api/billing/accounts', () => HttpResponse.json([])));
    const requests: Array<{ key: string | null; body: unknown }> = [];
    server.use(
      http.post(`*/api/billing/accounts/${ACCOUNT_ID}/payments`, async ({ request }) => {
        requests.push({ key: request.headers.get('Idempotency-Key'), body: await request.json() });
        account = accountDetail({
          orderStatus: 'PAID',
          table: { ...account.table, status: 'LIBRE' },
          paid: money(56),
          pending: money(0),
          payments: [payment(1, { amount: money(56), receivedAmount: money(60), changeAmount: money(4) })],
          canCharge: false,
        });
        return HttpResponse.json(account, { status: 201 });
      }),
    );
    renderAccount();

    await userEvent.type(await screen.findByLabelText('Monto recibido (S/)'), '60');
    expect(screen.getByText('Vuelto: S/ 4.00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cobrar' }));

    const dialog = await screen.findByRole('dialog', { name: 'Cobrar y liberar la mesa' });
    expect(dialog).toHaveTextContent('la mesa 5 quedará libre');
    expect(requests).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Cuenta pagada. La mesa 5 quedó libre.')).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(requests[0]?.body).toEqual({ method: 'CASH', amount: 56, receivedAmount: 60 });
  });

  it('con la mesa ocupada avisa que el mozo agregó pedidos y deshabilita "Cobrar"', async () => {
    mockAccount(accountDetail({ table: { id: accountDetail().table.id, tableNumber: 5, status: 'OCUPADA' }, canCharge: false }));
    renderAccount();

    expect(await screen.findByText('El mozo agregó pedidos. Espera a que vuelva a pedir la cuenta.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Dividir cuenta' })).not.toBeInTheDocument();
  });

  it('[005] AC-1.7: si la mesa vuelve a ocupada mientras la cuenta está abierta, se bloquea el cobro sin recargar', async () => {
    let account = accountDetail();
    mockAccount(() => account);
    const { realtime } = renderAccount();
    expect(await screen.findByRole('button', { name: 'Cobrar' })).toBeEnabled();

    account = accountDetail({ table: { ...account.table, status: 'OCUPADA' }, canCharge: false });
    realtime.emit('orders:table-status-changed', {
      tableId: account.table.id,
      tableNumber: 5,
      status: 'OCUPADA',
      orderId: ACCOUNT_ID,
      changedAt: '2026-10-29T19:40:00.000Z',
    });

    expect(await screen.findByText('El mozo agregó pedidos. Espera a que vuelva a pedir la cuenta.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cobrar' })).toBeDisabled();
    });
  });

  it('con total cero ofrece "Cerrar sin cobro" con confirmación', async () => {
    let account = accountDetail({ total: money(0), pending: money(0), canCharge: false, canCloseWithoutCharge: true });
    mockAccount(() => account);
    server.use(http.get('*/api/billing/accounts', () => HttpResponse.json([])));
    server.use(
      http.post(`*/api/billing/accounts/${ACCOUNT_ID}/close-without-charge`, () => {
        account = { ...account, orderStatus: 'PAID', canCloseWithoutCharge: false };
        return HttpResponse.json(account);
      }),
    );
    renderAccount();

    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sin cobro' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Cuenta pagada. La mesa 5 quedó libre.')).toBeInTheDocument();
  });

  it('anula un pago con motivo obligatorio', async () => {
    let account = accountDetail({ paid: money(20), pending: money(36), payments: [payment(1)] });
    mockAccount(() => account);
    let reason: unknown = null;
    server.use(
      http.post(`*/api/billing/accounts/${ACCOUNT_ID}/payments/${payment(1).id}/void`, async ({ request }) => {
        reason = await request.json();
        account = { ...account, paid: money(0), pending: money(56), payments: [payment(1, { status: 'VOIDED', voidReason: 'Error de monto', voidedBy: account.waiter })] };
        return HttpResponse.json(account);
      }),
    );
    renderAccount();

    await userEvent.click(await screen.findByRole('button', { name: 'Anular' }));
    const dialog = await screen.findByRole('dialog', { name: 'Anular pago' });
    const confirm = within(dialog).getByRole('button', { name: 'Confirmar anulación' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Motivo (obligatorio)'), 'Error de monto');
    await userEvent.click(confirm);

    expect(await screen.findByText(/Anulado por Rosa Quispe: Error de monto/)).toBeInTheDocument();
    expect(reason).toEqual({ reason: 'Error de monto' });
  });
});
