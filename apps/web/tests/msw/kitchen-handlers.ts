import type { KitchenBoard, ReadyNotice, Ticket, TicketItem, VoidNotice } from '@picanteria/shared';
import { http, HttpResponse } from 'msw';
import { server } from './server';

/** Datos y manejadores de /api/kitchen para las pruebas de la 004. */

export const SERVER_TIME = '2026-10-29T17:30:00.000Z';
export const JUAN = { id: '1a2b3c4d-0000-4000-8000-00000000000a', fullName: 'Juan Pérez' };

const uuid = (prefix: string, n: number): string => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Minutos antes de la hora del servidor, en ISO. */
export const minutesAgo = (minutes: number): string => new Date(Date.parse(SERVER_TIME) - minutes * 60_000).toISOString();

export function ticketItem(n: number, overrides: Partial<TicketItem> = {}): TicketItem {
  const item: TicketItem = {
    id: uuid('17e00000', n),
    name: 'Ají de gallina',
    quantity: 1,
    voidedQuantity: 0,
    toPrepare: 1,
    notes: null,
    status: 'PENDING',
    statusChangedAt: minutesAgo(5),
    canUndo: false,
    ...overrides,
  };
  return { ...item, toPrepare: overrides.toPrepare ?? item.quantity - item.voidedQuantity };
}

export function ticket(sequence: number, overrides: Partial<Ticket> = {}): Ticket {
  return {
    dispatchId: uuid('d1500000', sequence),
    sequence,
    tableNumber: 5,
    round: 1,
    sentBy: JUAN,
    sentAt: minutesAgo(5),
    state: 'ACTIVE',
    completedAt: null,
    items: [ticketItem(sequence)],
    ...overrides,
  };
}

export function voidNotice(n: number, overrides: Partial<VoidNotice> = {}): VoidNotice {
  return {
    itemVoidId: uuid('a01d0000', n),
    dispatchId: uuid('d1500000', n),
    tableNumber: 4,
    itemName: 'Rocoto relleno',
    units: 1,
    voidedAt: minutesAgo(1),
    ...overrides,
  };
}

export function kitchenBoard(overrides: Partial<KitchenBoard> = {}): KitchenBoard {
  return { serverTime: SERVER_TIME, active: [], completed: [], voidNotices: [], ...overrides };
}

export function readyNotice(n: number, overrides: Partial<ReadyNotice> = {}): ReadyNotice {
  return {
    id: uuid('4ead0000', n),
    orderItemId: uuid('17e00000', n),
    tableNumber: 5,
    itemName: 'Ají de gallina',
    quantity: 2,
    createdAt: minutesAgo(1),
    ...overrides,
  };
}

/** `GET /api/kitchen/board`; con una función, cada llamada puede devolver otro tablero. */
export function mockKitchenBoard(board: KitchenBoard | (() => KitchenBoard)): { calls: () => number } {
  let calls = 0;
  server.use(
    http.get('*/api/kitchen/board', () => {
      calls += 1;
      return HttpResponse.json(typeof board === 'function' ? board() : board);
    }),
  );
  return { calls: () => calls };
}

/** `GET /api/kitchen/ready-notices`. */
export function mockReadyNotices(notices: ReadyNotice[] | (() => ReadyNotice[])): void {
  server.use(http.get('*/api/kitchen/ready-notices', () => HttpResponse.json(typeof notices === 'function' ? notices() : notices)));
}

export interface RecordedPost {
  path: string;
  body: unknown;
}

/** Registra los POST de cocina y responde con `respond` (204 por defecto). */
export function recordKitchenPosts(respond: (path: string) => Response = () => new HttpResponse(null, { status: 204 })): RecordedPost[] {
  const posts: RecordedPost[] = [];
  server.use(
    http.post('*/api/kitchen/*', async ({ request }) => {
      const path = new URL(request.url).pathname;
      const text = await request.text();
      posts.push({ path, body: text ? (JSON.parse(text) as unknown) : undefined });
      return respond(path);
    }),
  );
  return posts;
}
