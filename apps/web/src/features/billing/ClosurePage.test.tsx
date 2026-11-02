import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { CAJERA, closureSummary } from '../../../tests/msw/billing-handlers';
import { apiError } from '../../../tests/msw/orders-handlers';
import { server } from '../../../tests/msw/server';
import { renderNavigableRoutes } from '../../../tests/render';
import { ClosurePage } from './ClosurePage';
import { ClosuresHistoryPage } from './ClosuresHistoryPage';

function renderClosure() {
  renderNavigableRoutes(
    [
      { path: '/caja/cierre', element: <ClosurePage /> },
      { path: '/caja/cierres', element: <ClosuresHistoryPage /> },
    ],
    '/caja/cierre',
  );
}

async function fillCounts(cash: string, yape: string, card: string) {
  await userEvent.type(screen.getByLabelText('Efectivo (S/)'), cash);
  await userEvent.type(screen.getByLabelText('Yape/Plin (S/)'), yape);
  await userEvent.type(screen.getByLabelText('Tarjeta (S/)'), card);
  await userEvent.click(screen.getByRole('button', { name: 'Ver diferencias' }));
}

describe('Feature 005 — cierre del día (/caja/cierre)', () => {
  it('[005] AC-3.1: el paso 1 pide lo contado sin mostrar lo registrado (conteo a ciegas)', async () => {
    let previewBody: unknown = null;
    server.use(
      http.post('*/api/billing/closures/preview', async ({ request }) => {
        previewBody = await request.json();
        return HttpResponse.json(closureSummary());
      }),
    );
    renderClosure();

    expect(screen.getByRole('heading', { name: 'Montos contados' })).toBeInTheDocument();
    expect(screen.queryByText('Registrado')).not.toBeInTheDocument();
    expect(screen.queryByText('S/ 65.00')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ver diferencias' }));
    expect(previewBody).toBeNull();

    await fillCounts('60', '30', '21.5');
    expect(await screen.findByText('Registrado')).toBeInTheDocument();
    expect(previewBody).toEqual({ countedCash: 60, countedYapePlin: 30, countedCard: 21.5 });
  });

  it('el paso 2 muestra registrado, contado y diferencia, y exige la observación si hay diferencias', async () => {
    let confirmBody: unknown = null;
    server.use(
      http.post('*/api/billing/closures/preview', () => HttpResponse.json(closureSummary())),
      http.post('*/api/billing/closures', async ({ request }) => {
        confirmBody = await request.json();
        return HttpResponse.json({ ...closureSummary(), id: 'c105e000-0000-4000-8000-000000000001', closedAt: '2026-10-30T04:00:00.000Z', cashier: CAJERA, notes: 'Vuelto mal dado' }, { status: 201 });
      }),
      http.get('*/api/billing/closures', () => HttpResponse.json([])),
    );
    renderClosure();
    await fillCounts('60', '30', '21.5');

    const cash = (await screen.findByText('Efectivo')).closest('tr');
    expect(cash).toHaveTextContent('S/ 65.00S/ 60.00Faltante S/ 5.00');
    expect(screen.getByText('Tarjeta').closest('tr')).toHaveTextContent('Sobrante S/ 1.50');
    expect(screen.getByText('Total del día').nextSibling).toHaveTextContent('S/ 115.00');
    expect(screen.getByText('Cuentas cobradas').nextSibling).toHaveTextContent('3');

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }));
    expect(screen.getByText('Explica las diferencias en la observación antes de cerrar')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Observación (obligatoria)'), 'Vuelto mal dado');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Cierre guardado.')).toBeInTheDocument();
    expect(confirmBody).toEqual({ countedCash: 60, countedYapePlin: 30, countedCard: 21.5, notes: 'Vuelto mal dado' });
  });

  it('con mesas abiertas avisa y lista las mesas', async () => {
    server.use(
      http.post('*/api/billing/closures/preview', () =>
        apiError(409, { code: 'CLOSURE_OPEN_TABLES', message: 'No puedes cerrar con mesas abiertas', details: { tables: [3, 7] } }),
      ),
    );
    renderClosure();
    await fillCounts('0', '0', '0');

    expect(await screen.findByText('No puedes cerrar con mesas abiertas')).toBeInTheDocument();
    expect(screen.getByText('Mesas abiertas: Mesa 3, Mesa 7')).toBeInTheDocument();
  });
});
