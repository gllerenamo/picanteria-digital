import { EventEmitter } from 'node:events';
import type { ServerToClientEvents } from '@picanteria/shared';
import type { RealtimeState } from '../src/lib/realtime-context';
import type { RealtimeSocket } from '../src/lib/socket';

/** Socket falso para simular eventos de tiempo real en las pruebas de componentes. */
export function fakeRealtime(): {
  state: RealtimeState;
  emit: <E extends keyof ServerToClientEvents>(event: E, payload: Parameters<ServerToClientEvents[E]>[0]) => void;
  reconnect: () => void;
} {
  const emitter = new EventEmitter();
  // Solo se usan on/off, que EventEmitter implementa con la misma forma.
  const socket = emitter as unknown as RealtimeSocket;
  return {
    state: { socket, connected: true },
    emit: (event, payload) => {
      emitter.emit(event, payload);
    },
    reconnect: () => {
      emitter.emit('connect');
    },
  };
}
