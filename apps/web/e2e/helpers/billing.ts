import { randomUUID } from 'node:crypto';
import { expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import { loginAs, type E2eLoginKey } from './auth';

/** Ayudantes de las pruebas de caja (005): cuentas por cobrar armadas con el flujo real de la 003. */

export const CSRF = { 'X-Requested-With': 'picanteria-web' };
/** Mesas que usan waiter.spec.ts y tablet.spec.ts (003); caja usa otras. */
export const RESERVED_TABLES = new Set([7, 8, 9, 10, 11, 12]);

/** Segunda sesión en su propio contexto, con la misma configuración de tablet del proyecto. */
export async function openSession(browser: Browser, testInfo: TestInfo, key: E2eLoginKey): Promise<Page> {
  const { baseURL, viewport, hasTouch, locale } = testInfo.project.use;
  const context = await browser.newContext({ baseURL, viewport, hasTouch, locale });
  const page = await context.newPage();
  await loginAs(page, key);
  return page;
}

export interface Bill {
  orderId: string;
  tableNumber: number;
  /** Total de la cuenta en soles. */
  total: number;
}

export async function freeTable(waiter: Page): Promise<{ id: string; tableNumber: number }> {
  const tables = (await (await waiter.request.get('/api/orders/tables')).json()) as Array<{ id: string; tableNumber: number; status: string }>;
  const table = tables.find((candidate) => candidate.status === 'LIBRE' && !RESERVED_TABLES.has(candidate.tableNumber));
  if (!table) throw new Error('No hay mesas libres para la prueba');
  return table;
}

/** El mozo abre una mesa libre, envía 2 unidades del primer plato de la carta y pide la cuenta (por la API). */
export async function billRequested(waiter: Page): Promise<Bill> {
  const api = waiter.request;
  const table = await freeTable(waiter);
  const order = (await (await api.post('/api/orders', { headers: CSRF, data: { tableId: table.id } })).json()) as { id: string };
  const tree = (await (await api.get('/api/menu/tree?availableOnly=true')).json()) as Array<{ items: Array<{ id: string }> }>;
  const menuItem = tree.flatMap((category) => category.items)[0];
  if (!menuItem) throw new Error('La carta no tiene platos disponibles');
  expect((await api.post(`/api/orders/${order.id}/items`, { headers: CSRF, data: { menuItemId: menuItem.id, quantity: 2 } })).ok()).toBe(true);
  expect((await api.post(`/api/orders/${order.id}/dispatches`, { headers: { ...CSRF, 'Idempotency-Key': randomUUID() } })).ok()).toBe(true);
  const billed = await api.post(`/api/orders/${order.id}/request-bill`, { headers: CSRF });
  expect(billed.ok()).toBe(true);
  const detail = (await billed.json()) as { consumption: { total: { amount: number } } };
  return { orderId: order.id, tableNumber: table.tableNumber, total: detail.consumption.total.amount };
}
