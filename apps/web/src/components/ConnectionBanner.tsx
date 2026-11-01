import { useSyncExternalStore } from 'react';
import { useRealtimeStatus } from '../lib/realtime-context';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const WAITER_MESSAGE = 'Sin conexión. Lo enviado está a salvo; para enviar a cocina necesitas conexión.';

/**
 * Aviso de que el dispositivo está sin conexión (FR-037). Compartido con la pantalla de cocina
 * (specs/003-mesas-pedidos/research.md §12), que muestra su propio mensaje (004 FR-025).
 */
export function ConnectionBanner({ message = WAITER_MESSAGE }: { message?: string }) {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine);
  const status = useRealtimeStatus();
  if (online && status !== 'disconnected') return null;
  return (
    <p role="status" className="rounded-lg border-2 border-danger bg-card px-4 py-3 text-lg font-semibold text-danger">
      {message}
    </p>
  );
}
