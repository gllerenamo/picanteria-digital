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

/**
 * Aviso de que el dispositivo está sin conexión (FR-037). Compartido con la pantalla de cocina
 * (specs/003-mesas-pedidos/research.md §12).
 */
export function ConnectionBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine);
  const status = useRealtimeStatus();
  if (online && status !== 'disconnected') return null;
  return (
    <p role="status" className="rounded-lg border-2 border-danger bg-card px-4 py-3 text-lg font-semibold text-danger">
      Sin conexión. Lo enviado está a salvo; para enviar a cocina necesitas conexión.
    </p>
  );
}
