import { expect, test, type Page } from '@playwright/test';
import { loginAs, type E2eUserKey } from './helpers/auth';

// SC-006, FR-024 y Principio IV: pantallas de ingreso, mozo y cocina utilizables en tablet.
const SCREENS: Array<{ path: string; user: E2eUserKey | null }> = [
  { path: '/ingresar', user: null },
  { path: '/mozo', user: 'mozo' },
  { path: '/cocina', user: 'cocina' },
];

async function openScreen(page: Page, path: string, user: E2eUserKey | null): Promise<void> {
  if (user) await loginAs(page, user);
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await page.waitForLoadState('networkidle');
}

test.describe('Principio IV — Pantallas para tablet', () => {
  for (const { path, user } of SCREENS) {
    test(`SC-006: ${path} no tiene desplazamiento horizontal`, async ({ page }) => {
      await openScreen(page, path, user);
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    });

    test(`Principio IV: los controles de ${path} miden al menos 44×44 px`, async ({ page }) => {
      await openScreen(page, path, user);
      const tooSmall = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button, a, input, select, textarea'))
          .filter((element) => {
            const box = element.getBoundingClientRect();
            const visible = box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
            return visible && (box.width < 44 || box.height < 44);
          })
          .map((element) => element.outerHTML.slice(0, 120)),
      );
      expect(tooSmall).toEqual([]);
    });
  }

  test('Principio IV: el texto de la pantalla de cocina mide al menos 18 px', async ({ page }) => {
    await openScreen(page, '/cocina', 'cocina');
    const sizes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main p')).map((element) => parseFloat(getComputedStyle(element).fontSize)),
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(18);
  });
});

// 003-mesas-pedidos: la pantalla del pedido también se usa en tablet (Principio IV, T061).
test.describe('Principio IV — Pedido de una mesa', () => {
  test('SC-006: /mozo/pedidos/:orderId no tiene desplazamiento horizontal y sus controles miden al menos 44×44 px', async ({
    page,
  }) => {
    await loginAs(page, 'mozo');
    await page.goto('/mozo');
    await page.getByRole('button', { name: /^Mesa 7(?!\d)/ }).click();
    await page.getByRole('button', { name: 'Abrir mesa' }).click();
    await expect(page).toHaveURL(/\/mozo\/pedidos\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('region', { name: 'Carta' }).getByRole('button').first()).toBeVisible();

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

    const tooSmall = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main button, main a, main input, main select, main textarea'))
        .filter((element) => {
          const box = element.getBoundingClientRect();
          const visible = box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
          return visible && (box.width < 44 || box.height < 44);
        })
        .map((element) => element.outerHTML.slice(0, 120)),
    );
    expect(tooSmall).toEqual([]);

    // Deja la mesa libre para la siguiente corrida.
    await page.getByRole('button', { name: 'Cancelar apertura' }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page).toHaveURL(/\/mozo$/);
  });
});
