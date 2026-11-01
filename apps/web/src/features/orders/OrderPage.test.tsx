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

  it('[003] AC-4.1: lo enviado se agrupa por ronda con su estado, aparte de lo que falta enviar', async () => {
    renderOrder(
      orderDetail({
        dispatches: [DISPATCH],
        items: [
          item({ menuItem: { id: ROCOTO.id, name: 'Chicha de Guiñapo' } }),
          sent({ status: 'PENDING' }),
          sent({ status: 'PREPARING', menuItem: { id: ROCOTO.id, name: 'Adobo' } }),
          sent({ status: 'READY', menuItem: { id: ROCOTO.id, name: 'Chupe' } }),
          sent({
            status: 'VOIDED',
            voidedQuantity: 1,
            activeQuantity: 0,
            menuItem: { id: ROCOTO.id, name: 'Ocopa' },
            voids: [{ id: 'ffff0000-0000-4000-8000-000000000001', units: 1, reason: 'Pedido por error', voidedBy: ROSA, voidedAt: '2026-10-29T17:50:00.000Z' }],
          }),
        ],
      }),
    );

    const enviado = await screen.findByRole('region', { name: 'Enviado' });
    expect(within(enviado).getByText(/Ronda 1/)).toBeInTheDocument();
    for (const label of ['Pendiente', 'En preparación', 'Listo', 'Anulado']) {
      expect(within(enviado).getByText(label)).toBeInTheDocument();
    }
    expect(within(enviado).getByText('1 anulada: Pedido por error')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Por enviar' })).getByText('Chicha de Guiñapo')).toBeInTheDocument();
  });

  it('[003] AC-4.2: cuando cocina cambia un estado, el mozo lo ve sin recargar', async () => {
    let current = orderDetail({ dispatches: [DISPATCH], items: [sent({ status: 'PENDING' })] });
    const { realtime } = renderOrder(() => current);
    const enviado = await screen.findByRole('region', { name: 'Enviado' });
    expect(within(enviado).getByText('Pendiente')).toBeInTheDocument();

    current = orderDetail({ dispatches: [DISPATCH], items: [{ ...current.items[0]!, status: 'PREPARING' }] });
    realtime.emit('kitchen:item-status-changed', {
      orderItemId: current.items[0]!.id,
      dispatchId: DISPATCH.id,
      tableNumber: 2,
      status: 'PREPARING',
      previousStatus: 'PENDING',
      isUndo: false,
      changedAt: '2026-10-29T17:50:00.000Z',
    });

    expect(await screen.findByText('En preparación')).toBeInTheDocument();
  });

  it('[003] AC-5.3: el administrador debe escribir el motivo para anular', async () => {
    const { user } = renderOrder(orderDetail({ dispatches: [DISPATCH], items: [sent({ quantity: 2 })] }), 'ADMIN');

    await user.click(await screen.findByRole('button', { name: 'Anular' }));
    const dialog = screen.getByRole('dialog', { name: 'Anular Rocoto Relleno' });
    expect(within(dialog).getByText('2 de 2')).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Anular' });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText('Motivo (obligatorio)'), 'ab');
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Motivo (obligatorio)'), 'c');
    expect(confirm).toBeEnabled();
  });

  it('[003] AC-5.3: un mozo no ve la acción de anular', async () => {
    renderOrder(orderDetail({ dispatches: [DISPATCH], items: [sent()] }), 'WAITER');

    await screen.findByRole('region', { name: 'Enviado' });
    expect(screen.queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument();
  });

  it('[003] AC-6.2: el consumo muestra cantidades, precio, subtotal y total en soles', async () => {
    renderOrder(
      orderDetail({
        dispatches: [DISPATCH],
        items: [sent({ quantity: 2 }), sent({ status: 'VOIDED', voidedQuantity: 1, activeQuantity: 0 })],
        consumption: { total: money(56) },
      }),
    );

    const consumo = await screen.findByRole('region', { name: 'Consumo' });
    expect(within(consumo).getByText('2 × Rocoto Relleno')).toBeInTheDocument();
    expect(within(consumo).getByText('S/ 28.00')).toBeInTheDocument();
    expect(within(consumo).getAllByText('S/ 56.00')).toHaveLength(2);
  });

  it('[003] AC-6.3: con ítems por enviar, pedir la cuenta muestra el aviso', async () => {
    const { user } = renderOrder(orderDetail({ dispatches: [DISPATCH], items: [sent(), item()] }));
    server.use(
      http.post(`*/api/orders/${ORDER_ID}/request-bill`, () =>
        apiError(409, {
          code: 'HAS_UNSENT_ITEMS',
          message: 'Hay ítems sin enviar. Envíalos o quítalos antes de pedir la cuenta.',
        }),
      ),
    );

    await user.click(await screen.findByRole('button', { name: 'Pedir la cuenta' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Pedir la cuenta' })).getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Hay ítems sin enviar. Envíalos o quítalos antes de pedir la cuenta.')).toBeInTheDocument();
  });

  it('[003] AC-6.7: agregar con la mesa por cobrar pide confirmar y vuelve a enviar con confirmReopen', async () => {
    const bodies: unknown[] = [];
    const { user } = renderOrder(
      orderDetail({ table: { ...orderDetail().table, status: 'POR_COBRAR' }, dispatches: [DISPATCH], items: [sent()] }),
    );
    server.use(
      http.post(`*/api/orders/${ORDER_ID}/items`, async ({ request }) => {
        bodies.push(await request.json());
        if (bodies.length === 1) {
          return apiError(409, {
            code: 'TABLE_AWAITING_PAYMENT',
            message: 'La mesa está por cobrar. Confirma para volver a abrirla y agregar.',
          });
        }
        return HttpResponse.json(item(), { status: 201 });
      }),
    );

    const carta = await screen.findByRole('region', { name: 'Carta' });
    await user.click(await within(carta).findByRole('button', { name: /Rocoto Relleno/ }));
    await user.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('La mesa está por cobrar. ¿Volver a abrirla para agregar?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pedir la cuenta' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => {
      expect(bodies).toHaveLength(2);
    });
    expect(bodies[0]).toMatchObject({ menuItemId: ROCOTO.id, confirmReopen: false });
    expect(bodies[1]).toMatchObject({ menuItemId: ROCOTO.id, confirmReopen: true });
  });
});
