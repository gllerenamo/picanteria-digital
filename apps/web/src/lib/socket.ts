import type { ServerToClientEvents } from '@picanteria/shared';
import { io, type Socket } from 'socket.io-client';

export type RealtimeSocket = Socket<ServerToClientEvents, Record<string, never>>;

/** Conecta al canal de tiempo real del mismo origen; se autentica con la cookie de sesión. */
export function connectRealtime(): RealtimeSocket {
  return io({ path: '/socket.io', withCredentials: true });
}
