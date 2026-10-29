import { describe, expect, it } from 'vitest';
import { APP_ROUTES, ROLES, ROLE_HOME, canAccess, routesFor, type Role } from './roles';

// Matriz de specs/001-base-comun/contracts/ui-routes.md y specs/002-carta/contracts/ui-routes.md.
const expected: Record<Role, Record<string, boolean>> = {
  ADMIN: { '/admin/usuarios': true, '/admin/carta': true, '/mozo': true, '/cocina': true, '/caja': true },
  WAITER: { '/admin/usuarios': false, '/admin/carta': false, '/mozo': true, '/cocina': false, '/caja': false },
  KITCHEN: { '/admin/usuarios': false, '/admin/carta': false, '/mozo': false, '/cocina': true, '/caja': false },
  CASHIER: { '/admin/usuarios': false, '/admin/carta': false, '/mozo': false, '/cocina': false, '/caja': true },
};

describe('canAccess', () => {
  for (const role of ROLES) {
    for (const route of APP_ROUTES) {
      const allowed = expected[role][route.path];
      it(`${role} ${allowed ? 'puede' : 'no puede'} abrir ${route.path}`, () => {
        expect(canAccess(role, route.path)).toBe(allowed);
      });
    }
  }

  it('aplica la regla a las subrutas', () => {
    expect(canAccess('WAITER', '/mozo/mesas')).toBe(true);
    expect(canAccess('WAITER', '/mozos')).toBe(false);
  });

  it('cada rol puede abrir su pantalla inicial', () => {
    for (const role of ROLES) expect(canAccess(role, ROLE_HOME[role])).toBe(true);
  });
});

describe('routesFor', () => {
  it('el administrador ve todas las pantallas en el menú', () => {
    expect(routesFor('ADMIN').map((r) => r.label)).toEqual(['Usuarios', 'Carta', 'Mozo', 'Cocina', 'Caja']);
  });

  it('los demás roles solo ven su pantalla', () => {
    expect(routesFor('WAITER').map((r) => r.label)).toEqual(['Mozo']);
    expect(routesFor('KITCHEN').map((r) => r.label)).toEqual(['Cocina']);
    expect(routesFor('CASHIER').map((r) => r.label)).toEqual(['Caja']);
  });
});
