import type { CurrentUser, Role } from '@picanteria/shared';
import { ROLE_HOME } from '@picanteria/shared';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';

export function currentUser(role: Role, overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: '6f1c2b8e-1d2a-4c3b-9e4f-1a2b3c4d5e6f',
    fullName: 'Usuario de Prueba',
    username: 'prueba',
    role,
    homePath: ROLE_HOME[role],
    ...overrides,
  };
}

/** Simula `GET /api/auth/me` con una sesión del rol indicado. */
export function mockSession(role: Role, overrides: Partial<CurrentUser> = {}): CurrentUser {
  const user = currentUser(role, overrides);
  server.use(http.get('*/api/auth/me', () => HttpResponse.json(user)));
  return user;
}
