import type { ServerToClientEvents } from '@picanteria/shared';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { RealtimeSocket } from './socket';

/** `connecting` hasta la primera conexión; `disconnected` tras un corte (FR-037). */
export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Socket de tiempo real compartido: lo abre `useRealtime` en `AppShell` y las pantallas se
 * suscriben con `useRealtimeEvent`, sin abrir otra conexión (specs/004-cocina/research.md §7,
 * specs/003-mesas-pedidos/research.md §11).
 */
export interface RealtimeState {
  socket: RealtimeSocket | null;
  status: RealtimeStatus;
}

const RealtimeContext = createContext<RealtimeState>({ socket: null, status: 'connecting' });

export function RealtimeProvider({ value, children }: { value: RealtimeState; children: ReactNode }) {
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/** Estado del canal de tiempo real (para el indicador de conexión). */
export function useRealtimeStatus(): RealtimeStatus {
  return useContext(RealtimeContext).status;
}

type EventPayload<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>[0];

/**
 * Vista sin genéricos del socket: socket.io tipa `on`/`off` con tipos condicionales que
 * TypeScript no puede resolver para un evento genérico `E`.
 */
interface UntypedListeners {
  on(event: string, listener: (payload: never) => void): unknown;
  off(event: string, listener: (payload: never) => void): unknown;
}

/** Ejecuta `handler` cada vez que llega el evento; siempre usa la última versión del manejador. */
export function useRealtimeEvent<E extends keyof ServerToClientEvents>(
  event: E,
  handler: (payload: EventPayload<E>) => void,
): void {
  const { socket } = useContext(RealtimeContext);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!socket) return;
    const channel = socket as unknown as UntypedListeners;
    const listener = (payload: EventPayload<E>): void => {
      handlerRef.current(payload);
    };
    channel.on(event, listener);
    return () => {
      channel.off(event, listener);
    };
  }, [socket, event]);
}

/** Ejecuta `handler` cada vez que el socket se conecta, incluida la reconexión tras un corte. */
export function useRealtimeReconnect(handler: () => void): void {
  const { socket } = useContext(RealtimeContext);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!socket) return;
    const listener = (): void => {
      handlerRef.current();
    };
    socket.on('connect', listener);
    return () => {
      socket.off('connect', listener);
    };
  }, [socket]);
}
