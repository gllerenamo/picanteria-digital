/**
 * Roles y matriz de acceso a pantallas (specs/001-base-comun/contracts/ui-routes.md).
 * Es la fuente única que usan el menú, la protección de rutas y las pruebas.
 */
export const ROLES = ['ADMIN', 'WAITER', 'KITCHEN', 'CASHIER'] as const;
export type Role = (typeof ROLES)[number];

export const Role = {
  ADMIN: 'ADMIN',
  WAITER: 'WAITER',
  KITCHEN: 'KITCHEN',
  CASHIER: 'CASHIER',
} as const satisfies Record<Role, Role>;

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  WAITER: 'Mozo',
  KITCHEN: 'Cocina',
  CASHIER: 'Cajero',
};

export const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/admin/usuarios',
  WAITER: '/mozo',
  KITCHEN: '/cocina',
  CASHIER: '/caja',
};

export interface AppRoute {
  path: string;
  /** Etiqueta en el menú de navegación. */
  label: string;
  /** Roles con acceso además de ADMIN, que accede a todas (FR-011). */
  roles: readonly Role[];
}

export const APP_ROUTES: readonly AppRoute[] = [
  { path: '/admin/usuarios', label: 'Usuarios', roles: [] },
  { path: '/mozo', label: 'Mozo', roles: ['WAITER'] },
  { path: '/cocina', label: 'Cocina', roles: ['KITCHEN'] },
  { path: '/caja', label: 'Caja', roles: ['CASHIER'] },
];

/** Pantalla de APP_ROUTES a la que pertenece una ruta (incluidas sus subrutas). */
export function appRouteFor(path: string): AppRoute | undefined {
  return APP_ROUTES.find((route) => path === route.path || path.startsWith(`${route.path}/`));
}

/** Indica si un rol puede abrir una pantalla interna. */
export function canAccess(role: Role, path: string): boolean {
  if (role === 'ADMIN') return true;
  return appRouteFor(path)?.roles.includes(role) ?? false;
}

/** Pantallas que aparecen en el menú de un rol, en el orden de APP_ROUTES. */
export function routesFor(role: Role): readonly AppRoute[] {
  return APP_ROUTES.filter((route) => canAccess(role, route.path));
}
