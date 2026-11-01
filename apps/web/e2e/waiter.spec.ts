import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { loginAs, type E2eLoginKey } from './helpers/auth';

// Recorrido del mozo en tablet (specs/003-mesas-pedidos). Usa las mesas 8 y 9 de la semilla e2e
// y cancela la apertura al terminar para dejarlas libres.

/** Segunda sesión en su propio contexto, con la misma configuración de tablet del proyecto. */
async function openSession(browser: Browser, testInfo: TestInfo, key: E2eLoginKey): Promise<Page> {
  const { baseURL, viewport, hasTouch, locale } = testInfo.project.use;
  const context = await browser.newContext({ baseURL, viewport, hasTouch, locale });
  const page = await context.newPage();
  await loginAs(page, key);
  return page;
}

const tableCard = (page: Page, tableNumber: number) =>
  page.getByRole('button', { name: new RegExp(`^Mesa ${tableNumber}(?!\\d)`) });

async function openTable(page: Page, tableNumber: number): Promise<void> {
  await page.goto('/mozo');
  await tableCard(page, tableNumber).click();
  await page.getByRole('button', { name: 'Abrir mesa' }).click();
  await expect(page).toHaveURL(/\/mozo\/pedidos\/[0-9a-f-]{36}$/);
}

async function addItem(page: Page, name: string): Promise<void> {
  await page.getByRole('region', { name: 'Carta' }).getByRole('button', { name: new RegExp(name) }).first().click();
  await page.getByRole('button', { name: 'Agregar' }).click();
  await expect(page.getByRole('region', { name: 'Por enviar' }).getByText(name)).toBeVisible();
}

async function cancelOpening(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Cancelar apertura' }).click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page).toHaveURL(/\/mozo$/);
}

test.describe('Feature 003 — el mozo abre una mesa', () => {
  test('[003] AC-1.2: abrir una mesa libre lleva directo a tomar su pedido', async ({ page }) => {
    await loginAs(page, 'mozo');
    await openTable(page, 9);
    await expect(page.getByRole('heading', { name: 'Mesa 9' })).toBeVisible();
    await expect(page.getByText('Responsable: Mozo de Pruebas')).toBeVisible();
    await cancelOpening(page);
  });

  test('[003] AC-1.3: otro mozo ve la mesa ocupada en menos de 3 s sin recargar', async ({ page, browser }, testInfo) => {
    const other = await openSession(browser, testInfo, 'mozo2');
    await other.goto('/mozo');
    await expect(tableCard(other, 8)).toContainText('Libre');

    await loginAs(page, 'mozo');
    await openTable(page, 8);

    await expect(tableCard(other, 8)).toContainText('Ocupada', { timeout: 3000 });
    await cancelOpening(page);
    await other.context().close();
  });
});

// Las mesas 10 a 12 quedan ocupadas con un envío; la semilla e2e las libera en la siguiente corrida.
test.describe('Feature 003 — el mozo envía a cocina desde la tablet', () => {
  test('[003] AC-3.1: el envío se confirma y los ítems pasan a pendiente', async ({ page }) => {
    await loginAs(page, 'mozo');
    await openTable(page, 10);
    await addItem(page, 'Rocoto Relleno');

    await page.getByRole('button', { name: 'Enviar a cocina' }).click();

    await expect(page.getByText('Ronda 1 enviada a cocina')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Enviado' }).getByText('Pendiente')).toBeVisible();
  });

  test('[003] AC-3.8: sin conexión el envío no sale y se reintenta al volver la conexión', async ({ page }) => {
    await loginAs(page, 'mozo');
    await openTable(page, 11);
    await addItem(page, 'Rocoto Relleno');

    await page.context().setOffline(true);
    await page.getByRole('button', { name: 'Enviar a cocina' }).click();
    await expect(page.getByText('No se pudo enviar: no hay conexión. Tus ítems siguen por enviar.')).toBeVisible();
    await expect(page.getByText(/^Sin conexión\./)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Por enviar' }).getByText('Rocoto Relleno')).toBeVisible();

    await page.context().setOffline(false);
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.getByText('Ronda 1 enviada a cocina')).toBeVisible();
  });

  test('[003] AC-3.9: si se pierde la respuesta del envío, el reintento no lo duplica', async ({ page }) => {
    await loginAs(page, 'mozo');
    await openTable(page, 12);
    await addItem(page, 'Rocoto Relleno');
    const orderId = new URL(page.url()).pathname.split('/').pop() ?? '';

    // El envío llega al servidor, pero la respuesta no vuelve a la tablet.
    await page.route('**/api/orders/*/dispatches', async (route) => {
      await route.fetch();
      await route.abort();
    });
    await page.getByRole('button', { name: 'Enviar a cocina' }).click();
    await expect(page.getByText(/No se pudo enviar/)).toBeVisible();
    await page.unroute('**/api/orders/*/dispatches');

    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.getByText('Ronda 1 enviada a cocina')).toBeVisible();

    const response = await page.request.get(`/api/orders/${orderId}`);
    const order = (await response.json()) as { dispatches: unknown[] };
    expect(order.dispatches).toHaveLength(1);
  });
});
