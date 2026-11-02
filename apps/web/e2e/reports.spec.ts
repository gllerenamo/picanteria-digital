import { expect, test } from '@playwright/test';
import { loginAs } from './helpers/auth';

// Reportes del administrador (specs/005-caja-reportes, US4 y US5).

test.describe('Feature 005 — reportes', () => {
  test('[005] AC-4.5: el cajero no puede abrir los reportes; el administrador sí', async ({ page }) => {
    await loginAs(page, 'caja');
    await page.goto('/admin/reportes');
    await expect(page.getByRole('heading', { name: 'No tienes permiso para ver esta pantalla' })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/ingresar$/);

    await loginAs(page, 'admin');
    await page.getByRole('navigation', { name: 'Menú principal' }).getByRole('link', { name: 'Reportes' }).click();
    await expect(page).toHaveURL(/\/admin\/reportes$/);
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Ventas' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Total vendido')).toBeVisible();
  });
});
