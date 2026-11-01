import { useEffect, useMemo, useState } from 'react';

/** Cada cuánto se recalculan los minutos de espera (FR-019 pide al menos una vez por minuto). */
const TICK_MS = 15_000;

/**
 * Hora del servidor en milisegundos: la tablet puede tener la hora desfasada, así que se usa la
 * diferencia con `serverTime` del tablero (research.md §9). Se vuelve a calcular cada 15 s.
 */
export function useServerNow(serverTime: string | undefined): number {
  const offset = useMemo(() => (serverTime ? Date.parse(serverTime) - Date.now() : 0), [serverTime]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((tick) => tick + 1);
    }, TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return Date.now() + offset;
}
