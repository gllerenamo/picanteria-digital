import { expect, test } from '@playwright/test';
import { loginAs, type E2eUserKey } from './helpers/auth';

const MENU: Record<E2eUserKey, string[]> = {
  admin: ['Usuarios', 'Mozo', 'Cocina', 'Caja'],
  mozo: ['Mozo'],
  cocina: ['Cocina'],
  caja: ['Caja'],
};
const FORBIDDEN_TEXT = 'No tienes permiso para ver esta pantalla';

test.describe('US2 — Cada rol ve solo sus pantallas', () => {
  for (const [key, labels] of Object.entries(MENU) as Array<[E2eUserKey, string[]]>) {
    test(`[001] AC-2.1: el menú de ${key} muestra solo sus opciones`, async ({ page }) => {
      await loginAs(page, key);
      const menu = page.getByRole('navigation', { name: 'Menú principal' });
      await expect(menu.getByRole('link')).toHaveText(labels);
      await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    });
  }

  test('[001] AC-2.2: el mozo no puede abrir por dirección las pantallas de otros roles', async ({ page }) => {
    await loginAs(page, 'mozo');
    for (const path of ['/caja', '/cocina', '/admin/usuarios']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: FORBIDDEN_TEXT })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Volver a mi inicio' }).click();
    await expect(page).toHaveURL(/\/mozo$/);
  });

  test('[001] AC-2.5: el administrador abre las pantallas de mozo, cocina y caja', async ({ page }) => {
    await loginAs(page, 'admin');
    for (const [path, title] of [
      ['/mozo', 'Mozo'],
      ['/cocina', 'Cocina'],
      ['/caja', 'Caja'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(page.getByText(FORBIDDEN_TEXT)).toHaveCount(0);
    }
  });

  for (const key of ['mozo', 'cocina', 'caja'] as const) {
    test(`[001] AC-2.6: ${key} no puede abrir la gestión de usuarios`, async ({ page }) => {
      await loginAs(page, key);
      await page.goto('/admin/usuarios');
      await expect(page.getByRole('heading', { name: FORBIDDEN_TEXT })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Gestión de usuarios' })).toHaveCount(0);
    });
  }
});
