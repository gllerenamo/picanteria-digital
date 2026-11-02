import type { AccountDetail, AccountItem, AccountSummary, BillPart, ClosureSummary, Money, Payment, SalesReport, TopDish } from '@picanteria/shared';
import { http, HttpResponse } from 'msw';
import { ROSA } from '../fixtures';
import { server } from './server';

/** Datos y manejadores de /api/billing y /api/reports para las pruebas de la 005. */

export const ACCOUNT_ID = 'ca1a0000-0000-4000-8000-000000000005';
export const CAJERA = { id: 'ca1e0000-0000-4000-8000-00000000000c', fullName: 'Carmen Flores' };

export const money = (amount: number): Money => ({ amount, formatted: `S/ ${amount.toFixed(2)}` });
const uuid = (prefix: string, n: number): string => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function accountItem(n: number, overrides: Partial<AccountItem> & { price?: number } = {}): AccountItem {
  const { price = 28, ...rest } = overrides;
  const quantity = rest.quantity ?? 1;
  const voidedQuantity = rest.voidedQuantity ?? 0;
  const activeQuantity = quantity - voidedQuantity;
  return {
    orderItemId: uuid('17e50000', n),
    menuItem: { id: uuid('3e1a0000', n), name: 'Rocoto Relleno' },
    quantity,
    voidedQuantity,
    activeQuantity,
    unitPrice: money(price),
    subtotal: money(price * activeQuantity),
    paidUnits: 0,
    ...rest,
  };
}

export function payment(n: number, overrides: Partial<Payment> = {}): Payment {
  return {
    id: uuid('9a7e0000', n),
    method: 'CASH',
    amount: money(20),
    receivedAmount: money(20),
    changeAmount: money(0),
    reference: null,
    partId: null,
    cashier: CAJERA,
    paidAt: '2026-10-29T19:30:00.000Z',
    status: 'VALID',
    voidReason: null,
    voidedBy: null,
    ...overrides,
  };
}

export function billPart(n: number, overrides: Partial<BillPart> = {}): BillPart {
  return {
    id: uuid('9a1e0000', n),
    position: n,
    label: `Parte ${String(n)}`,
    amount: money(28),
    paid: money(0),
    pending: money(28),
    items: [],
    ...overrides,
  };
}

/**
 * Mesa 5 por cobrar de Rosa: 2 Rocoto Relleno a S/ 28.00 (y 1 anulado) y una Chicha Morada
 * anulada del todo. Total S/ 56.00.
 */
export function accountDetail(overrides: Partial<AccountDetail> = {}): AccountDetail {
  return {
    orderId: ACCOUNT_ID,
    orderStatus: 'OPEN',
    table: { id: uuid('7ab1e000', 5), tableNumber: 5, status: 'POR_COBRAR' },
    waiter: ROSA,
    items: [
      accountItem(1, { quantity: 3, voidedQuantity: 1 }),
      accountItem(2, { menuItem: { id: uuid('3e1a0000', 2), name: 'Chicha Morada' }, quantity: 2, voidedQuantity: 2, price: 6.5 }),
    ],
    total: money(56),
    paid: money(0),
    pending: money(56),
    payments: [],
    split: null,
    canCharge: true,
    canCloseWithoutCharge: false,
    ...overrides,
  };
}

export function accountSummary(tableNumber: number, overrides: Partial<AccountSummary> = {}): AccountSummary {
  return {
    orderId: uuid('ca1a0000', tableNumber),
    tableNumber,
    tableStatus: 'POR_COBRAR',
    waiter: ROSA,
    total: money(56),
    paid: money(0),
    pending: money(56),
    ...overrides,
  };
}

/** `GET /api/billing/accounts`; con una función, cada llamada puede devolver otra lista. */
export function mockPendingAccounts(accounts: AccountSummary[] | (() => AccountSummary[])): void {
  server.use(http.get('*/api/billing/accounts', () => HttpResponse.json(typeof accounts === 'function' ? accounts() : accounts)));
}

/** `GET /api/billing/accounts/:id`. */
export function mockAccount(account: AccountDetail | (() => AccountDetail)): void {
  const resolve = (): AccountDetail => (typeof account === 'function' ? account() : account);
  server.use(http.get(`*/api/billing/accounts/${resolve().orderId}`, () => HttpResponse.json(resolve())));
}

export function closureSummary(overrides: Partial<ClosureSummary> = {}): ClosureSummary {
  return {
    startedAt: '2026-10-29T13:00:00.000Z',
    lines: [
      { method: 'CASH', expected: money(65), counted: money(60), difference: money(-5) },
      { method: 'YAPE_PLIN', expected: money(30), counted: money(30), difference: money(0) },
      { method: 'CARD', expected: money(20), counted: money(21.5), difference: money(1.5) },
    ],
    total: money(115),
    accountsCount: 3,
    hasDifferences: true,
    ...overrides,
  };
}

export function salesReport(overrides: Partial<SalesReport> = {}): SalesReport {
  return {
    from: '2026-10-01',
    to: '2026-10-31',
    total: money(180),
    accountsCount: 3,
    averageTicket: money(60),
    byDay: [
      { date: '2026-10-10', total: money(100), accountsCount: 1 },
      { date: '2026-10-11', total: money(80), accountsCount: 2 },
    ],
    byMethod: [
      { method: 'CASH', total: money(100) },
      { method: 'YAPE_PLIN', total: money(20) },
      { method: 'CARD', total: money(60) },
    ],
    ...overrides,
  };
}

export function topDish(rank: number, name: string, units: number, amount: number): TopDish {
  return { rank, menuItem: { id: uuid('3e1a0000', 100 + rank), name }, units, amount: money(amount) };
}
