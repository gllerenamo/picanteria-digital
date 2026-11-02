import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { money, salesReport, topDish } from '../../../tests/msw/billing-handlers';
import { server } from '../../../tests/msw/server';
import { renderNavigableRoutes } from '../../../tests/render';
import { currentMonth, ReportsPage } from './ReportsPage';

function renderReports() {
  renderNavigableRoutes([{ path: '/admin/reportes', element: <ReportsPage /> }], '/admin/reportes');
}

describe('Feature 005 — reportes (/admin/reportes)', () => {
  it('el rango por defecto es el mes actual (hora de Perú)', () => {
    expect(currentMonth(new Date('2026-02-10T12:00:00Z'))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    // 31/10 a las 22:00 en Lima ya es 1/11 en UTC.
    expect(currentMonth(new Date('2026-11-01T03:00:00Z'))).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('"Ventas" muestra total, cuentas, ticket promedio y las tablas por día y por método', async () => {
    const requested: string[] = [];
    server.use(
      http.get('*/api/reports/sales', ({ request }) => {
        requested.push(new URL(request.url).search);
        return HttpResponse.json(salesReport());
      }),
    );
    renderReports();

    expect(await screen.findByText('Total vendido')).toBeInTheDocument();
    const month = currentMonth();
    expect(requested[0]).toBe(`?from=${month.from}&to=${month.to}`);
    expect(screen.getByText('Total vendido').nextSibling).toHaveTextContent('S/ 180.00');
    expect(screen.getByText('Cuentas cobradas').nextSibling).toHaveTextContent('3');
    expect(screen.getByText('Ticket promedio').nextSibling).toHaveTextContent('S/ 60.00');
    const byDay = within(screen.getByRole('region', { name: 'Ventas por día' }));
    expect(byDay.getByText('10/10/2026').closest('tr')).toHaveTextContent('1S/ 100.00');
    const byMethod = within(screen.getByRole('region', { name: 'Ventas por método' }));
    expect(byMethod.getByText('Yape/Plin').closest('tr')).toHaveTextContent('S/ 20.00');
  });

  it('un rango sin ventas muestra "No hay ventas en este rango"', async () => {
    server.use(
      http.get('*/api/reports/sales', () =>
        HttpResponse.json(
          salesReport({
            total: money(0),
            accountsCount: 0,
            averageTicket: money(0),
            byDay: [],
            byMethod: [
              { method: 'CASH', total: money(0) },
              { method: 'YAPE_PLIN', total: money(0) },
              { method: 'CARD', total: money(0) },
            ],
          }),
        ),
      ),
    );
    renderReports();

    expect(await screen.findByText('No hay ventas en este rango')).toBeInTheDocument();
  });

  it('"Platos más vendidos" ordena por unidades y cambia a "Por monto"', async () => {
    server.use(
      http.get('*/api/reports/sales', () => HttpResponse.json(salesReport())),
      http.get('*/api/reports/top-dishes', ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get('sortBy') === 'amount'
            ? [topDish(1, 'Ají de Gallina', 5, 100), topDish(2, 'Lomo Saltado', 2, 90), topDish(3, 'Chicha Morada', 2, 12)]
            : [topDish(1, 'Ají de Gallina', 5, 100), topDish(2, 'Chicha Morada', 2, 12), topDish(3, 'Lomo Saltado', 2, 90)],
        ),
      ),
    );
    renderReports();

    await userEvent.click(screen.getByRole('tab', { name: 'Platos más vendidos' }));
    const names = async () => {
      const table = await screen.findByRole('table', { name: 'Ranking de platos' });
      return within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[1]?.textContent);
    };
    expect(screen.getByRole('button', { name: 'Por unidades' })).toHaveAttribute('aria-pressed', 'true');
    expect(await names()).toEqual(['Ají de Gallina', 'Chicha Morada', 'Lomo Saltado']);

    await userEvent.click(screen.getByRole('button', { name: 'Por monto' }));
    await waitFor(async () => {
      expect(await names()).toEqual(['Ají de Gallina', 'Lomo Saltado', 'Chicha Morada']);
    });
  });
});

