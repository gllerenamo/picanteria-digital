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
