import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

export type E2eUserKey = 'admin' | 'mozo' | 'cocina' | 'caja';

interface E2eUser {
  key: E2eUserKey;
  username: string;
  password: string;
  fullName: string;
}

// Mismas credenciales de prueba que usa apps/api/prisma/seed-e2e.ts.
const users = JSON.parse(
  readFileSync(new URL('../../../api/prisma/e2e-users.json', import.meta.url), 'utf8'),
) as E2eUser[];

export function e2eUser(key: E2eUserKey): E2eUser {
  const user = users.find((candidate) => candidate.key === key);
  if (!user) throw new Error(`No existe el usuario de prueba ${key}`);
  return user;
}

export async function loginWith(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/ingresar');
  await page.getByLabel('Usuario').fill(username);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

/** Inicia sesión con un usuario de prueba y espera a salir de /ingresar. */
export async function loginAs(page: Page, key: E2eUserKey): Promise<void> {
  const user = e2eUser(key);
  await loginWith(page, user.username, user.password);
  await expect(page).not.toHaveURL(/\/ingresar$/);
}
