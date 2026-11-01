import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  JUAN,
  SERVER_TIME,
  kitchenBoard,
  minutesAgo,
  mockKitchenBoard,
  recordKitchenPosts,
  ticket,
  ticketItem,
  voidNotice,
} from '../../../tests/msw/kitchen-handlers';
import { fakeRealtime } from '../../../tests/realtime';
import { renderRoutes } from '../../../tests/render';
import { RealtimeProvider, type RealtimeState } from '../../lib/realtime-context';
import { KitchenBoardPage } from './KitchenBoardPage';
import { playTone } from './sound';

vi.mock('./sound', async (importOriginal) => ({ ...(await importOriginal<typeof import('./sound')>()), playTone: vi.fn() }));

function renderKitchen(state?: Partial<RealtimeState>) {
  const realtime = fakeRealtime();
  renderRoutes(
    [
      {
        path: '/cocina',
        element: (
          <RealtimeProvider value={{ ...realtime.state, ...state }}>
            <KitchenBoardPage />
          </RealtimeProvider>
        ),
      },
    ],
    '/cocina',
  );
  return realtime;
}

const comanda = (sequence: number) => screen.findByRole('article', { name: `Comanda N.º ${sequence}` });
const dispatchEvent = (sequence: number) => ({
  dispatchId: ticket(sequence).dispatchId,
  sequence,
  round: 1,
  orderId: 'c0ffee00-0000-4000-8000-000000000001',
  tableNumber: 2,
  itemCount: 1,
  sentAt: SERVER_TIME,
});

describe('Feature 004 — pantalla de cocina (/cocina)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(playTone).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('[004] AC-1.1: sin comandas activas muestra "No hay pedidos pendientes"', async () => {
    mockKitchenBoard(kitchenBoard());
    renderKitchen();

    expect(await screen.findByText('No hay pedidos pendientes')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cocina' })).toBeInTheDocument();
  });

  it('[004] AC-1.3: un envío nuevo aparece al final, resaltado y con sonido, sin recargar', async () => {
    let board = kitchenBoard({ active: [ticket(12)] });
    mockKitchenBoard(() => board);
    const realtime = renderKitchen();
    expect(await comanda(12)).not.toHaveTextContent('Nueva');
    expect(playTone).not.toHaveBeenCalled();

    board = kitchenBoard({ active: [ticket(12), ticket(13, { tableNumber: 2 })] });
    realtime.emit('orders:dispatch-sent', dispatchEvent(13));

    expect(await comanda(13)).toHaveTextContent('Nueva');
    expect(screen.getAllByRole('article').map((article) => article.getAttribute('aria-label'))).toEqual([
      'Comanda N.º 12',
      'Comanda N.º 13',
    ]);
    expect(playTone).toHaveBeenCalledTimes(1);
  });

  it('[004] AC-1.4: la comanda muestra número, mesa, mozo, hora y la nota resaltada', async () => {
    const sentAt = minutesAgo(2);
    mockKitchenBoard(
      kitchenBoard({
        active: [ticket(5, { sentAt, items: [ticketItem(1, { name: 'Ají de gallina', quantity: 2, notes: 'sin ají' })] })],
      }),
    );
    renderKitchen();

    const card = await comanda(5);
    const time = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' }).format(new Date(sentAt));
    expect(card).toHaveTextContent('N.º 5 · Mesa 5');
    expect(card).toHaveTextContent(`${JUAN.fullName} · ${time}`);
    expect(within(card).getByRole('listitem', { name: '2 × Ají de gallina' })).toHaveTextContent('Nota: sin ají');
  });

  it('con "Silenciar", una comanda nueva no suena', async () => {
    let board = kitchenBoard();
    mockKitchenBoard(() => board);
    const realtime = renderKitchen();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Silenciar' }));
    expect(screen.getByRole('button', { name: 'Activar sonido' })).toHaveAttribute('aria-pressed', 'true');

    board = kitchenBoard({ active: [ticket(7)] });
    realtime.emit('orders:dispatch-sent', dispatchEvent(7));

    expect(await comanda(7)).toHaveTextContent('Nueva');
    expect(playTone).not.toHaveBeenCalled();
  });

  it('sin conexión muestra el aviso y al reconectarse vuelve a pedir el tablero', async () => {
    const board = mockKitchenBoard(kitchenBoard());
    const realtime = renderKitchen({ status: 'disconnected' });

    expect(await screen.findByText('Sin conexión — los pedidos nuevos no se están recibiendo.')).toBeInTheDocument();
    await waitFor(() => {
      expect(board.calls()).toBe(1);
    });
    realtime.reconnect();
    await waitFor(() => {
      expect(board.calls()).toBe(2);
    });
  });

  it('[004] AC-2.5: "Deshacer" pide confirmación y solo entonces llama a la API', async () => {
    const item = ticketItem(1, { name: 'Adobo', status: 'PREPARING', canUndo: true });
    mockKitchenBoard(kitchenBoard({ active: [ticket(3, { items: [item] })] }));
    const posts = recordKitchenPosts(() => HttpResponse.json({ ...item, status: 'PENDING', canUndo: false }));
    renderKitchen();
    const user = userEvent.setup();

    const row = within(await comanda(3)).getByRole('listitem', { name: '1 × Adobo' });
    await user.click(within(row).getByRole('button', { name: 'Deshacer' }));
    const dialog = screen.getByRole('dialog', { name: '¿Deshacer el último cambio?' });
    expect(dialog).toHaveTextContent('1 × Adobo volverá a “Pendiente”.');
    expect(posts).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Deshacer' }));

    await waitFor(() => {
      expect(posts).toEqual([{ path: `/api/kitchen/items/${item.id}/undo`, body: { from: 'PREPARING' } }]);
    });
  });

  it('[004] AC-4.1: el tiempo de espera sube solo, sin recargar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(SERVER_TIME) });
    mockKitchenBoard(kitchenBoard({ active: [ticket(8, { sentAt: minutesAgo(3) })] }));
    renderKitchen();
    expect(await comanda(8)).toHaveTextContent('3 min');

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    await waitFor(async () => {
      expect(await comanda(8)).toHaveTextContent('4 min');
    });
  });

  it('[004] AC-4.2: desde 15 min la comanda dice "Demorado" y desde 25 min "Muy demorado"', async () => {
    mockKitchenBoard(
      kitchenBoard({ active: [ticket(1, { sentAt: minutesAgo(10) }), ticket(2, { sentAt: minutesAgo(16) }), ticket(3, { sentAt: minutesAgo(26) })] }),
    );
    renderKitchen();

    expect(await comanda(1)).toHaveTextContent(/10 min(?! ·)/);
    expect(await comanda(2)).toHaveTextContent('16 min · Demorado');
    expect(await comanda(3)).toHaveTextContent('26 min · Muy demorado');
  });

  it('[004] AC-5.1: un plato anulado aparece tachado, con "ANULADO" y sin botones', async () => {
    mockKitchenBoard(
      kitchenBoard({
        active: [
          ticket(4, {
            items: [ticketItem(1, { name: 'Chupe de camarones', status: 'VOIDED', voidedQuantity: 1, toPrepare: 0 }), ticketItem(2, { name: 'Adobo' })],
          }),
        ],
      }),
    );
    renderKitchen();

    const row = within(await comanda(4)).getByRole('listitem', { name: '1 × Chupe de camarones' });
    expect(row).toHaveTextContent('ANULADO');
    expect(within(row).getByText('1 × Chupe de camarones')).toHaveClass('line-through');
    expect(within(row).queryAllByRole('button')).toEqual([]);
  });

  it('[004] AC-5.2: al anular 1 de 3 rocotos, la comanda muestra 2 por preparar y "1 anulada"', async () => {
    mockKitchenBoard(
      kitchenBoard({
        active: [ticket(6, { items: [ticketItem(1, { name: 'Rocoto relleno', quantity: 3, voidedQuantity: 1, status: 'PREPARING' })] })],
      }),
    );
    renderKitchen();

    const row = within(await comanda(6)).getByRole('listitem', { name: '2 × Rocoto relleno' });
    expect(row).toHaveTextContent('1 anulada');
    expect(row).toHaveTextContent('En preparación');
    expect(within(row).getByRole('button', { name: 'Listo' })).toBeEnabled();
  });

  it('[004] AC-5.5: una anulación aparece arriba con sonido hasta tocar "Entendido"', async () => {
    let board = kitchenBoard({ active: [ticket(6)] });
    mockKitchenBoard(() => board);
    const posts = recordKitchenPosts();
    const realtime = renderKitchen();
    await comanda(6);

    const notice = voidNotice(1);
    board = kitchenBoard({ active: [ticket(6)], voidNotices: [notice] });
    realtime.emit('orders:item-voided', {
      itemVoidId: notice.itemVoidId,
      orderItemId: ticketItem(6).id,
      dispatchId: notice.dispatchId,
      tableNumber: 4,
      units: 1,
      remainingQuantity: 2,
      voidedAt: notice.voidedAt,
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Mesa 4: 1 × Rocoto relleno anulado');
    expect(playTone).toHaveBeenCalledTimes(1);

    board = kitchenBoard({ active: [ticket(6)] });
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Entendido' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(posts).toEqual([{ path: `/api/kitchen/void-notices/${notice.itemVoidId}/ack`, body: undefined }]);
  });
});
