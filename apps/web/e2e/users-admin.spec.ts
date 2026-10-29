import { expect, test, type Browser, type Page } from '@playwright/test';
import { loginAs, loginWith } from './helpers/auth';

const CSRF = { 'X-Requested-With': 'picanteria-web' };
const PASSWORD = 'clave-prueba-123';

// Los usuarios creados por las pruebas llevan el prefijo "prueba." y los borra seed-e2e.
function uniqueUsername(): string {
  return `prueba.${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

async function createUserViaApi(adminPage: Page, role: string): Promise<string> {
  const username = uniqueUsername();
  const response = await adminPage.request.post('/api/users', {
    headers: CSRF,
    data: { fullName: `Persona ${username}`, username, password: PASSWORD, role },
  });
  expect(response.status()).toBe(201);
  return username;
}

async function openAs(browser: Browser, username: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await loginWith(page, username, PASSWORD);
  return page;
}

test.describe('US3 — El administrador gestiona los usuarios', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/usuarios');
    await expect(page.getByRole('heading', { name: 'Gestión de usuarios' })).toBeVisible();
  });

  test('[001] AC-3.1: el administrador registra un usuario desde la interfaz y este puede ingresar', async ({ page, browser }) => {
    const username = uniqueUsername();
    await page.getByRole('button', { name: 'Nuevo usuario' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nombre completo').fill('Mozo Nuevo');
    await dialog.getByLabel('Usuario').fill(username);
    await dialog.getByLabel('Contraseña').fill(PASSWORD);
    await dialog.getByLabel('Rol').selectOption({ label: 'Mozo' });
    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('row', { name: new RegExp(username) })).toBeVisible();

    const newUserPage = await openAs(browser, username);
    await expect(newUserPage).toHaveURL(/\/mozo$/);
  });

  test('[001] AC-3.9: la lista muestra nombre, usuario, rol y estado, sin contraseñas', async ({ page }) => {
    const username = await createUserViaApi(page, 'CASHIER');
    await page.reload();
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader')).toHaveText(['Nombre completo', 'Usuario', 'Rol', 'Estado', 'Acciones']);
    const row = table.getByRole('row', { name: new RegExp(username) });
    await expect(row).toContainText('Cajero');
    await expect(row).toContainText('Activo');
    await expect(table).not.toContainText(PASSWORD);
  });

  test('[001] AC-3.6: desactivar con confirmación saca al usuario de su sesión abierta', async ({ page, browser }) => {
    const username = await createUserViaApi(page, 'KITCHEN');
    const userPage = await openAs(browser, username);
    await expect(userPage).toHaveURL(/\/cocina$/);

    await page.reload();
    const row = page.getByRole('row', { name: new RegExp(username) });
    await row.getByRole('button', { name: 'Desactivar' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('No podrá ingresar al sistema.');
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(row).toContainText('Inactivo');

    await expect(userPage).toHaveURL(/\/ingresar$/);
    await expect(userPage.getByText('Tu cuenta fue desactivada. Consulta al administrador.')).toBeVisible();
  });

  test('[001] AC-2.4: cambiar el rol de un mozo conectado redibuja su menú y lo lleva a su nueva pantalla', async ({
    page,
    browser,
  }) => {
    const username = await createUserViaApi(page, 'WAITER');
    const userPage = await openAs(browser, username);
    await expect(userPage).toHaveURL(/\/mozo$/);

    await page.reload();
    await page.getByRole('row', { name: new RegExp(username) }).getByRole('button', { name: 'Editar' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Rol').selectOption({ label: 'Cajero' });
    await dialog.getByRole('button', { name: 'Guardar' }).click();

    await expect(userPage).toHaveURL(/\/caja$/);
    await expect(userPage.getByRole('navigation', { name: 'Menú principal' }).getByRole('link')).toHaveText(['Caja']);
  });
});
