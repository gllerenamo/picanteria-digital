/** Eventos de tiempo real (specs/001-base-comun/contracts/websocket-events.md). */
export const REALTIME_EVENTS = {
  SESSION_REVOKED: 'auth:session-revoked',
  PROFILE_CHANGED: 'auth:profile-changed',
} as const;

export interface SessionRevokedPayload {
  reason: 'USER_DISABLED' | 'LOGGED_OUT';
}

export interface ProfileChangedPayload {
  fields: Array<'fullName' | 'role'>;
}

/** Tipado de los eventos que el servidor envía al cliente. */
export interface ServerToClientEvents {
  'auth:session-revoked': (payload: SessionRevokedPayload) => void;
  'auth:profile-changed': (payload: ProfileChangedPayload) => void;
}
