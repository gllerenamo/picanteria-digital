import { randomUUID } from 'node:crypto';
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { loginAs, type E2eLoginKey } from './helpers/auth';

// Recorrido de cocina en tablet (specs/004-cocina). El envío lo prepara el mozo por la API con
// su propia sesión, sobre una mesa libre; la semilla e2e borra esos pedidos en la siguiente corrida.

const CSRF = { 'X-Requested-With': 'picanteria-web' };

/** Segunda sesión en su propio contexto, con la misma configuración de tablet del proyecto. */
async function openSession(browser: Browser, testInfo: TestInfo, key: E2eLoginKey): Promise<Page> {
  const { baseURL, viewport, hasTouch, locale } = testInfo.project.use;
  const context = await browser.newContext({ baseURL, viewport, hasTouch, locale });
  const page = await context.newPage();
  await loginAs(page, key);
  return page;
}

interface SentRound {
  tableNumber: number;
  sequence: number;
  itemName: string;
}

/** El mozo abre una mesa libre, pide un plato de la carta y lo envía a cocina. */
async function sendRound(waiter: Page): Promise<SentRound> {
  const api = waiter.request;
  const tables = (await (await api.get('/api/orders/tables')).json()) as Array<{ id: string; tableNumber: number; status: string }>;
  const table = tables.filter((candidate) => candidate.status === 'LIBRE').at(-1);
  if (!table) throw new Error('No hay mesas libres para la prueba');

  const opened = await api.post('/api/orders', { headers: CSRF, data: { tableId: table.id } });
  expect(opened.ok()).toBe(true);
  const order = (await opened.json()) as { id: string };

  const tree = (await (await api.get('/api/menu/tree?availableOnly=true')).json()) as Array<{ items: Array<{ id: string; name: string }> }>;
  const menuItem = tree.flatMap((category) => category.items)[0];
  if (!menuItem) throw new Error('La carta no tiene platos disponibles');
  expect((await api.post(`/api/orders/${order.id}/items`, { headers: CSRF, data: { menuItemId: menuItem.id, quantity: 1 } })).ok()).toBe(true);

  const sent = await api.post(`/api/orders/${order.id}/dispatches`, { headers: { ...CSRF, 'Idempotency-Key': randomUUID() } });
  expect(sent.ok()).toBe(true);
  const dispatch = (await sent.json()) as { sequence: number };
  return { tableNumber: table.tableNumber, sequence: dispatch.sequence, itemName: menuItem.name };
}

async function openKitchen(page: Page): Promise<void> {
  await page.goto('/cocina');
  await expect(page.getByRole('heading', { name: 'Cocina' })).toBeVisible();
}

const comanda = (page: Page, sequence: number) => page.getByRole('article', { name: `Comanda N.º ${sequence}` });

test.describe('Feature 004 — cocina en tablet', () => {
  test('[004] AC-1.3: un envío del mozo aparece en cocina en menos de 3 s, sin recargar', async ({ page, browser }, testInfo) => {
    await loginAs(page, 'cocina');
    await openKitchen(page);
    const waiter = await openSession(browser, testInfo, 'mozo');

    const round = await sendRound(waiter);

    const card = comanda(page, round.sequence);
    await expect(card).toBeVisible({ timeout: 3000 });
    await expect(card).toContainText(`Mesa ${round.tableNumber}`);
    await expect(card).toContainText('Nueva');
    await waiter.context().close();
  });

  test('[004] AC-2.6: "Preparar" en una tablet se ve en la otra en menos de 3 s', async ({ page, browser }, testInfo) => {
    await loginAs(page, 'cocina');
    await openKitchen(page);
    const other = await openSession(browser, testInfo, 'cocina');
    await openKitchen(other);
    const waiter = await openSession(browser, testInfo, 'mozo');
    const round = await sendRound(waiter);
    await expect(comanda(other, round.sequence)).toContainText('Pendiente');

    await comanda(page, round.sequence).getByRole('button', { name: 'Preparar' }).click();

    await expect(comanda(other, round.sequence)).toContainText('En preparación', { timeout: 3000 });
    await other.context().close();
    await waiter.context().close();
  });

  test('[004] AC-3.1: al marcar "Listo", el mozo responsable ve el aviso sin recargar', async ({ page, browser }, testInfo) => {
    await loginAs(page, 'cocina');
    await openKitchen(page);
    const waiter = await openSession(browser, testInfo, 'mozo');
    await waiter.goto('/mozo');
    const round = await sendRound(waiter);
    const card = comanda(page, round.sequence);
    await card.getByRole('button', { name: 'Preparar' }).click();

    await card.getByRole('button', { name: 'Listo' }).click();

    const notice = waiter.getByText(`Mesa ${round.tableNumber}: 1 × ${round.itemName} — listo`);
    await expect(notice).toBeVisible({ timeout: 3000 });
    await waiter.getByRole('button', { name: 'Visto' }).click();
    await expect(notice).toBeHidden();
    await waiter.context().close();
  });
});
