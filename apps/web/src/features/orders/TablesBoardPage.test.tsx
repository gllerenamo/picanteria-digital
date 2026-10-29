import type { TableOverview } from '@picanteria/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { ORDER_ID, ROSA, sampleTables, tableOverview } from '../../../tests/fixtures';
import { apiError, mockTablesBoard } from '../../../tests/msw/orders-handlers';
import { server } from '../../../tests/msw/server';
import { fakeRealtime } from '../../../tests/realtime';
import { renderRoutes } from '../../../tests/render';
import { RealtimeProvider } from '../../lib/realtime-context';
import { TablesBoardPage } from './TablesBoardPage';

function renderBoard() {
  const realtime = fakeRealtime();
  renderRoutes(
    [
      {
        path: '/mozo',
        element: (
          <RealtimeProvider value={realtime.state}>
            <TablesBoardPage />
          </RealtimeProvider>
        ),
      },
      { path: '/mozo/pedidos/:orderId', element: <p>Pedido abierto</p> },
    ],
    '/mozo',
  );
  return realtime;
}

const card = (tableNumber: number) => screen.findByRole('button', { name: new RegExp(`^Mesa ${tableNumber}\\D`) });

describe('Feature 003 — tablero de mesas (/mozo)', () => {
  it('[003] AC-1.1: muestra cada mesa con su número, su estado y el responsable de las no libres', async () => {
    mockTablesBoard(sampleTables());
    renderBoard();

    expect(await screen.findByRole('heading', { name: 'Mozo' })).toBeInTheDocument();
    expect(await card(1)).toHaveTextContent('Libre');
    expect(await card(2)).toHaveTextContent('Ocupada');
    expect(await card(2)).toHaveTextContent('Rosa Quispe · 3 comensales');
    expect(await card(3)).toHaveTextContent('Por cobrar');
  });

  it('[003] AC-1.3: al llegar el evento de otro mozo, la mesa aparece ocupada sin recargar', async () => {
    let tables: TableOverview[] = [tableOverview(1)];
    mockTablesBoard(() => tables);
    const realtime = renderBoard();
    expect(await card(1)).toHaveTextContent('Libre');

    tables = [
      tableOverview(1, {
        status: 'OCUPADA',
        order: { id: ORDER_ID, waiter: ROSA, guestCount: null, openedAt: '2026-10-29T18:00:00.000Z', hasUnsentItems: false },
      }),
    ];
    realtime.emit('orders:table-status-changed', {
      tableId: tableOverview(1).id,
      tableNumber: 1,
      status: 'OCUPADA',
      orderId: ORDER_ID,
      changedAt: '2026-10-29T18:00:00.000Z',
    });

    await waitFor(async () => {
      expect(await card(1)).toHaveTextContent('Ocupada');
    });
  });

  it('[003] AC-1.5: si otro mozo la abrió primero, se muestra quién y se actualiza el tablero', async () => {
    let calls = 0;
    mockTablesBoard(() => {
      calls += 1;
      return [tableOverview(1)];
    });
    server.use(
      http.post('*/api/orders', () =>
        apiError(409, {
          code: 'TABLE_NOT_AVAILABLE',
          message: 'La mesa ya la abrió Rosa Quispe',
          details: { status: 'OCUPADA', openedBy: ROSA },
        }),
      ),
    );
    renderBoard();
    const user = userEvent.setup();

    await user.click(await card(1));
    await user.click(await screen.findByRole('button', { name: 'Abrir mesa' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La mesa ya la abrió Rosa Quispe');
    await waitFor(() => {
      expect(calls).toBeGreaterThanOrEqual(2);
    });
  });
});
