import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { billRequested, CSRF, freeTable, openSession } from './helpers/billing';
import { seedE2e } from './helpers/seed';

// Recorrido de caja en tablet (specs/005-caja-reportes) con el flujo real de la 003: el mozo
// toma, envía y pide la cuenta; el cajero la cobra y la mesa queda libre.

const tableCard = (page: Page, tableNumber: number) => page.getByRole('button', { name: new RegExp(`^Mesa ${tableNumber}(?!\\d)`) });
const accountLink = (page: Page, tableNumber: number) =>
  page.getByRole('list', { name: 'Mesas por cobrar' }).getByRole('link', { name: new RegExp(`^Mesa ${tableNumber}(?!\\d)`) });

test.describe('Feature 005 — cobrar la cuenta en caja', () => {
  test('[005] AC-1.1: la mesa por cobrar aparece en caja sin recargar cuando el mozo pide la cuenta', async ({ page, browser }, testInfo) => {
    await loginAs(page, 'caja');
    await page.goto('/caja');
    await expect(page.getByRole('heading', { name: 'Caja', exact: true })).toBeVisible();

    const waiter = await openSession(browser, testInfo, 'mozo');
    const table = await freeTable(waiter);
    await waiter.goto('/mozo');
    await tableCard(waiter, table.tableNumber).click();
    await waiter.getByRole('button', { name: 'Abrir mesa' }).click();
    await waiter.getByRole('region', { name: 'Carta' }).getByRole('button').first().click();
    await waiter.getByRole('button', { name: 'Agregar' }).click();
    await waiter.getByRole('button', { name: 'Enviar a cocina' }).click();
    await expect(waiter.getByText('Ronda 1 enviada a cocina')).toBeVisible();
    await waiter.getByRole('button', { name: 'Pedir la cuenta' }).click();
    await waiter.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();

    const card = accountLink(page, table.tableNumber);
    await expect(card).toBeVisible({ timeout: 3000 });
    await expect(card).toContainText('Mozo de Pruebas');
    await expect(card).toContainText(/Total: S\/ \d+\.\d{2}/);

    // Deja la mesa libre: cobra con tarjeta por la API.
    const orderId = (await card.getAttribute('href'))?.split('/').pop() ?? '';
    const account = (await (await page.request.get(`/api/billing/accounts/${orderId}`)).json()) as { pending: { amount: number } };
    const paid = await page.request.post(`/api/billing/accounts/${orderId}/payments`, {
      headers: { ...CSRF, 'Idempotency-Key': randomUUID() },
      data: { method: 'CARD', amount: account.pending.amount },
    });
    expect(paid.ok()).toBe(true);
    await waiter.context().close();
  });

  test('[005] AC-1.3: el cajero cobra en efectivo, ve el vuelto y el mozo ve la mesa libre', async ({ page, browser }, testInfo) => {
    const waiter = await openSession(browser, testInfo, 'mozo');
    const bill = await billRequested(waiter);
    await waiter.goto('/mozo');
    await expect(tableCard(waiter, bill.tableNumber)).toContainText('Por cobrar');

    await loginAs(page, 'caja');
    await page.goto('/caja');
    await accountLink(page, bill.tableNumber).click();
    await expect(page.getByRole('heading', { name: `Mesa ${bill.tableNumber}` })).toBeVisible();
    const received = Math.ceil(bill.total) + 10;
    await page.getByLabel('Monto recibido (S/)').fill(String(received));
    await expect(page.getByText(`Vuelto: S/ ${(received - bill.total).toFixed(2)}`)).toBeVisible();
    await page.getByRole('button', { name: 'Cobrar' }).click();
    await page.getByRole('dialog', { name: 'Cobrar y liberar la mesa' }).getByRole('button', { name: 'Confirmar' }).click();

    await expect(page.getByText(`Cuenta pagada. La mesa ${bill.tableNumber} quedó libre.`)).toBeVisible();
    await expect(tableCard(waiter, bill.tableNumber)).toContainText('Libre', { timeout: 3000 });
    await waiter.context().close();
  });

  test('[005] AC-1.8: el mozo no puede abrir la pantalla de caja', async ({ page }) => {
    await loginAs(page, 'mozo');
    await page.goto('/caja');
    await expect(page.getByRole('heading', { name: 'No tienes permiso para ver esta pantalla' })).toBeVisible();
  });

  test('[005] AC-2.1: divide en 2 partes iguales, cobra una con Yape/Plin y otra en efectivo, y libera la mesa', async ({
    page,
    browser,
  }, testInfo) => {
    const waiter = await openSession(browser, testInfo, 'mozo');
    const bill = await billRequested(waiter);
    await waiter.context().close();

    await loginAs(page, 'caja');
    await page.goto(`/caja/cuentas/${bill.orderId}`);
    await page.getByRole('button', { name: 'Dividir cuenta' }).click();
    const parts = page.getByRole('list', { name: 'Montos por parte' }).getByRole('listitem');
    await expect(parts).toHaveCount(2);
    await page.getByRole('button', { name: 'Confirmar división' }).click();

    const partsRegion = page.getByRole('region', { name: 'Partes' });
    await partsRegion.getByRole('button', { name: 'Cobrar esta parte' }).first().click();
    await page.getByRole('region', { name: 'Cobro' }).getByText('Yape/Plin').click();
    await page.getByLabel('Referencia (opcional)').fill('OP-778899');
    await page.getByRole('region', { name: 'Cobro' }).getByRole('button', { name: 'Cobrar' }).click();
    await expect(partsRegion.getByText('Pagada')).toHaveCount(1);

    await partsRegion.getByRole('button', { name: 'Cobrar esta parte' }).click();
    await page.getByLabel('Monto recibido (S/)').fill(String(Math.ceil(bill.total)));
    await page.getByRole('region', { name: 'Cobro' }).getByRole('button', { name: 'Cobrar' }).click();
    await page.getByRole('dialog', { name: 'Cobrar y liberar la mesa' }).getByRole('button', { name: 'Confirmar' }).click();

    await expect(page.getByText(`Cuenta pagada. La mesa ${bill.tableNumber} quedó libre.`)).toBeVisible();
  });
});

test.describe('Feature 005 — cierre del día', () => {
  // El cierre exige todas las mesas libres: la semilla borra los pedidos que dejaron las otras pruebas.
  test.beforeEach(() => {
    seedE2e();
  });

  test('[005] AC-3.2: con una diferencia en efectivo, el cierre exige la observación y queda en el historial', async ({
    page,
  }) => {
    await loginAs(page, 'caja');
    await page.goto('/caja');
    await page.getByRole('link', { name: 'Cierre del día' }).click();

    await page.getByLabel('Efectivo (S/)').fill('0.50');
    await page.getByLabel('Yape/Plin (S/)').fill('0');
    await page.getByLabel('Tarjeta (S/)').fill('0');
    await page.getByRole('button', { name: 'Ver diferencias' }).click();

    await expect(page.getByRole('columnheader', { name: 'Registrado' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Efectivo/ })).toContainText('Sobrante');
    await page.getByRole('button', { name: 'Confirmar cierre' }).click();
    await expect(page.getByText('Explica las diferencias en la observación antes de cerrar')).toBeVisible();

    const notes = `Prueba e2e ${randomUUID().slice(0, 8)}`;
    await page.getByLabel('Observación (obligatoria)').fill(notes);
    await page.getByRole('button', { name: 'Confirmar cierre' }).click();
    await page.getByRole('dialog', { name: 'Confirmar cierre' }).getByRole('button', { name: 'Confirmar' }).click();

    await expect(page).toHaveURL(/\/caja\/cierres$/);
    await expect(page.getByText('Cierre guardado.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Cierres' }).getByRole('listitem').first()).toContainText(`Observación: ${notes}`);
  });
});
