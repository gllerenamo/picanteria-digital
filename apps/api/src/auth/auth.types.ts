import type { Role } from '@picanteria/shared';

/** Usuario autenticado, leído de la base en cada petición (FR-012). */
export interface AuthenticatedUser {
  id: string;
  fullName: string;
  username: string;
  role: Role;
}

export interface SessionContext {
  sessionId: string;
  user: AuthenticatedUser;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: SessionContext;
  }
}
