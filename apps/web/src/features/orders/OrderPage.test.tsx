import type {
  CategoryWithItemsResponse,
  DispatchResponse,
  DispatchSummary,
  Money,
  OrderDetail,
  OrderItemResponse,
  Role,
} from '@picanteria/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockSession, ORDER_ID, orderDetail, ROSA } from '../../../tests/fixtures';
import { apiError, mockMenuTree, mockOrder } from '../../../tests/msw/orders-handlers';
import { server } from '../../../tests/msw/server';
import { fakeRealtime } from '../../../tests/realtime';
import { renderRoutes } from '../../../tests/render';
import { RealtimeProvider } from '../../lib/realtime-context';
import { OrderPage } from './OrderPage';

const money = (amount: number): Money => ({ amount, formatted: `S/ ${amount.toFixed(2)}` });

const ROCOTO = { id: 'aaaa1111-1111-4111-8111-111111111111', name: 'Rocoto Relleno' };
const DISPATCH: DispatchSummary = {
  id: 'dddd0000-0000-4000-8000-000000000001',
  sequence: 1,
  round: 1,
  sentBy: ROSA,
  sentAt: '2026-10-29T17:45:00.000Z',
};

let itemCounter = 0;
function item(overrides: Partial<OrderItemResponse> = {}): OrderItemResponse {
  itemCounter += 1;
  return {
    id: `eeee0000-0000-4000-8000-${String(itemCounter).padStart(12, '0')}`,
    menuItem: ROCOTO,
    quantity: 1,
    voidedQuantity: 0,
    activeQuantity: 1,
    notes: null,
    status: 'DRAFT',
    dispatchId: null,
    unitPrice: null,
    subtotal: null,
    currentPrice: money(24.5),
    isAvailable: true,
    voids: [],
    ...overrides,
  };
}

/** Ítem enviado en la ronda 1, con precio y subtotal. */
function sent(overrides: Partial<OrderItemResponse> = {}): OrderItemResponse {
  const quantity = overrides.quantity ?? 1;
  const activeQuantity = overrides.activeQuantity ?? quantity;
  return item({
    status: 'PENDING',
    dispatchId: DISPATCH.id,
    unitPrice: money(28),
    subtotal: money(28 * activeQuantity),
    currentPrice: null,
    isAvailable: null,
    quantity,
    activeQuantity,
    ...overrides,
  });
}

const MENU: CategoryWithItemsResponse[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Entradas',
    sortOrder: 1,
    isActive: true,
    createdAt: '2026-10-28T12:00:00.000Z',
    updatedAt: '2026-10-28T12:00:00.000Z',
    items: [
      {
        id: ROCOTO.id,
        categoryId: '11111111-1111-4111-8111-111111111111',
        categoryName: 'Entradas',
        name: ROCOTO.name,
        description: null,
        price: 24.5,
        priceFormatted: 'S/ 24.50',
        isAvailable: true,
        isActive: true,
        createdAt: '2026-10-28T12:00:00.000Z',
        updatedAt: '2026-10-28T12:00:00.000Z',
      },
    ],
  },
];

function renderOrder(order: OrderDetail | (() => OrderDetail), role: Role = 'WAITER') {
  mockSession(role);
  mockMenuTree(MENU);
  mockOrder(order);
  const realtime = fakeRealtime();
  renderRoutes(
    [
      {
        path: '/mozo/pedidos/:orderId',
        element: (
          <RealtimeProvider value={realtime.state}>
            <OrderPage />
          </RealtimeProvider>
        ),
      },
      { path: '/mozo', element: <p>Mesas</p> },
    ],
    `/mozo/pedidos/${ORDER_ID}`,
  );
  return { realtime, user: userEvent.setup() };
}

const dispatchResponse = (items: OrderItemResponse[]): DispatchResponse => ({
  ...DISPATCH,
  orderId: ORDER_ID,
  tableNumber: 2,
  items,
});

beforeEach(() => {
  // La clave de idempotencia queda en sessionStorage entre pruebas.
  sessionStorage.clear();
});

describe('Feature 003 — pedido de una mesa (/mozo/pedidos/:orderId)', () => {
  it('[003] AC-2.1: la carta pide solo lo disponible y muestra nombre y precio en soles', async () => {
    let requestedAvailableOnly = false;
    renderOrder(orderDetail());
    server.use(
      http.get('*/api/menu/tree', ({ request }) => {
        requestedAvailableOnly = new URL(request.url).searchParams.get('availableOnly') === 'true';
        return HttpResponse.json(MENU);
      }),
    );

    const carta = await screen.findByRole('region', { name: 'Carta' });
    expect(await within(carta).findByRole('button', { name: /Rocoto Relleno/ })).toHaveTextContent('S/ 24.50');
    expect(requestedAvailableOnly).toBe(true);
  });

  it('[003] AC-2.6: quitar un ítem por enviar pide confirmación antes de llamar a la API', async () => {
    let deletes = 0;
    const draft = item({ notes: 'sin ají' });
    const { user } = renderOrder(orderDetail({ items: [draft] }));
    server.use(
      http.delete(`*/api/order-items/${draft.id}`, () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await user.click(await screen.findByRole('button', { name: 'Quitar' }));
    expect(screen.getByRole('dialog', { name: 'Quitar ítem' })).toBeInTheDocument();
    expect(deletes).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => {
      expect(deletes).toBe(1);
    });
  });

  it('[003] AC-3.1: al enviar se ve la confirmación y los ítems pasan a pendiente', async () => {
    const draft = item({ quantity: 2, notes: 'sin ají' });
    let current = orderDetail({ items: [draft] });
    const { user } = renderOrder(() => current);
    server.use(
      http.post(`*/api/orders/${ORDER_ID}/dispatches`, () => {
        const pending = sent({ ...draft, status: 'PENDING', dispatchId: DISPATCH.id, quantity: 2, activeQuantity: 2 });
        current = orderDetail({ items: [pending], dispatches: [DISPATCH] });
        return HttpResponse.json(dispatchResponse([pending]), { status: 201 });
      }),
    );

    await user.click(await screen.findByRole('button', { name: 'Enviar a cocina' }));

    expect(await screen.findByText('Ronda 1 enviada a cocina')).toBeInTheDocument();
    const enviado = await screen.findByRole('region', { name: 'Enviado' });
    expect(within(enviado).getByText('Pendiente')).toBeInTheDocument();
    expect(within(enviado).getByText('2 × Rocoto Relleno')).toBeInTheDocument();
  });

  it('[003] AC-3.4: sin ítems nuevos el botón de enviar está deshabilitado', async () => {
    renderOrder(orderDetail({ items: [sent()], dispatches: [DISPATCH] }));

    expect(await screen.findByRole('button', { name: 'Enviar a cocina' })).toBeDisabled();
  });

  it('[003] AC-3.4: si otro mozo ya envió, se ve que no hay nada nuevo que enviar', async () => {
    const { user } = renderOrder(orderDetail({ items: [item()] }));
    server.use(
      http.post(`*/api/orders/${ORDER_ID}/dispatches`, () =>
        apiError(409, { code: 'NOTHING_TO_SEND', message: 'No hay nada nuevo que enviar' }),
      ),
    );

    await user.click(await screen.findByRole('button', { name: 'Enviar a cocina' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay nada nuevo que enviar');
  });

  it('[003] AC-3.5: si un plato se agotó, no se envía y el ítem queda marcado', async () => {
    const draft = item();
    let current = orderDetail({ items: [draft] });
    const { user } = renderOrder(() => current);
    server.use(
      http.post(`*/api/orders/${ORDER_ID}/dispatches`, () => {
        current = orderDetail({ items: [{ ...draft, isAvailable: false }] });
        return apiError(409, {
          code: 'ITEMS_UNAVAILABLE',
          message: 'Algunos platos ya no están disponibles. Quítalos o cámbialos para enviar.',
          details: { items: [{ orderItemId: draft.id, menuItemId: ROCOTO.id, name: ROCOTO.name }] },
        });
      }),
    );

    await user.click(await screen.findByRole('button', { name: 'Enviar a cocina' }));

    expect(await screen.findByText(/Algunos platos ya no están disponibles/)).toBeInTheDocument();
    expect(await screen.findByText(/No disponible: quítalo o cámbialo para enviar/)).toBeInTheDocument();
  });

  it('[003] AC-3.8: sin conexión el envío no sale, los ítems siguen y "Reintentar" usa la misma clave', async () => {
    const draft = item();
    const keys: Array<string | null> = [];
    const { user } = renderOrder(orderDetail({ items: [draft] }));
    server.use(
      http.post(`*/api/orders/${ORDER_ID}/dispatches`, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        if (keys.length === 1) return HttpResponse.error();
        return HttpResponse.json(dispatchResponse([sent()]), { status: 201 });
      }),
    );

    await user.click(await screen.findByRole('button', { name: 'Enviar a cocina' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo enviar: no hay conexión. Tus ítems siguen por enviar.',
    );
    expect(within(screen.getByRole('region', { name: 'Por enviar' })).getByText('Rocoto Relleno')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => {
      expect(keys).toHaveLength(2);
    });
    expect(keys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(keys[1]).toBe(keys[0]);
  });

});
