import type { Role } from '@picanteria/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockSession } from '../../tests/fixtures';
import { renderRoutes } from '../../tests/render';
import { NavMenu } from './NavMenu';

const expected: Record<Role, string[]> = {
  ADMIN: ['Usuarios', 'Carta', 'Mozo', 'Cocina', 'Caja'],
  WAITER: ['Mozo'],
  KITCHEN: ['Cocina'],
  CASHIER: ['Caja'],
};

describe('NavMenu', () => {
  for (const [role, labels] of Object.entries(expected) as Array<[Role, string[]]>) {
    it(`muestra a ${role} solo sus opciones`, async () => {
      mockSession(role);
      renderRoutes([{ path: '*', element: <NavMenu /> }], '/');
      const menu = await screen.findByRole('navigation', { name: 'Menú principal' });
      const links = await within(menu).findAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual(labels);
    });
  }
});
