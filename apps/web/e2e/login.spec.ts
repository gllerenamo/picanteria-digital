import { expect, test } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('US1 — Inicio de sesión', () => {
  test('[001] AC-1.7: sin sesión, una pantalla interna redirige a /ingresar', async ({ page }) => {
    await page.goto('/mozo');
    await expect(page).toHaveURL(/\/ingresar$/);
    await expect(page.getByRole('heading', { name: 'Ingresar' })).toBeVisible();
  });

  test('[001] AC-1.1: el mozo ingresa y llega a su pantalla inicial', async ({ page }) => {
    await loginAs(page, 'mozo');
    await expect(page).toHaveURL(/\/mozo$/);
    await expect(page.getByText('Hola, Mozo de Pruebas')).toBeVisible();
  });

  test('[001] AC-1.5: cerrar sesión vuelve a /ingresar y Atrás no muestra la pantalla interna', async ({ page }) => {
    await loginAs(page, 'mozo');
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/ingresar$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/ingresar$/);
    await expect(page.getByText('Hola, Mozo de Pruebas')).toHaveCount(0);
  });
});
