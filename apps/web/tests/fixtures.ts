import type { CurrentUser, OrderDetail, Role, TableOverview } from '@picanteria/shared';
import { ROLE_HOME } from '@picanteria/shared';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';

export function currentUser(role: Role, overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: '6f1c2b8e-1d2a-4c3b-9e4f-1a2b3c4d5e6f',
    fullName: 'Usuario de Prueba',
    username: 'prueba',
    role,
    homePath: ROLE_HOME[role],
    ...overrides,
  };
}

/** Simula `GET /api/auth/me` con una sesión del rol indicado. */
export function mockSession(role: Role, overrides: Partial<CurrentUser> = {}): CurrentUser {
  const user = currentUser(role, overrides);
  server.use(http.get('*/api/auth/me', () => HttpResponse.json(user)));
  return user;
}

// ---------------------------------------------------------------------------
// 003-mesas-pedidos: mesas y pedidos de ejemplo

export const ROSA = { id: '7a2d3c9f-2e3b-4d4c-8f5a-2b3c4d5e6f70', fullName: 'Rosa Quispe' };
export const ORDER_ID = 'c0ffee00-0000-4000-8000-000000000001';

export function tableOverview(tableNumber: number, overrides: Partial<TableOverview> = {}): TableOverview {
  return {
    id: `${String(tableNumber).padStart(8, '0')}-0000-4000-8000-000000000000`,
    tableNumber,
    capacity: 4,
    status: 'LIBRE',
    order: null,
    ...overrides,
  };
}

/** Mesa 1 libre, mesa 2 ocupada por Rosa con 3 comensales y mesa 3 por cobrar. */
export function sampleTables(): TableOverview[] {
  return [
    tableOverview(1),
    tableOverview(2, {
      status: 'OCUPADA',
      order: { id: ORDER_ID, waiter: ROSA, guestCount: 3, openedAt: '2026-10-29T17:40:00.000Z', hasUnsentItems: false },
    }),
    tableOverview(3, {
      status: 'POR_COBRAR',
      order: {
        id: 'c0ffee00-0000-4000-8000-000000000003',
        waiter: ROSA,
        guestCount: null,
        openedAt: '2026-10-29T17:10:00.000Z',
        hasUnsentItems: false,
      },
    }),
  ];
}

export function orderDetail(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: ORDER_ID,
    status: 'OPEN',
    table: { id: tableOverview(2).id, tableNumber: 2, status: 'OCUPADA' },
    waiter: ROSA,
    guestCount: 3,
    openedAt: '2026-10-29T17:40:00.000Z',
    closedAt: null,
    items: [],
    dispatches: [],
    consumption: { total: { amount: 0, formatted: 'S/ 0.00' } },
    canCancel: true,
    canRequestBill: false,
    ...overrides,
  };
}
