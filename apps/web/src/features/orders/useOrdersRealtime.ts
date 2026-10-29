import { REALTIME_EVENTS } from '@picanteria/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useRealtimeEvent, useRealtimeReconnect } from '../../lib/realtime-context';
import { ORDERS_KEY } from './api';

/**
 * El evento avisa y la consulta manda: ante cualquier cambio de mesas, envíos, anulaciones o
 * estados de cocina, y al reconectarse, se vuelven a pedir los datos (research.md §11).
 */
export function useOrdersRealtime(): void {
  const queryClient = useQueryClient();
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
  }, [queryClient]);

  useRealtimeEvent(REALTIME_EVENTS.TABLE_STATUS_CHANGED, refresh);
  useRealtimeEvent(REALTIME_EVENTS.DISPATCH_SENT, refresh);
  useRealtimeEvent(REALTIME_EVENTS.ITEM_VOIDED, refresh);
  useRealtimeEvent(REALTIME_EVENTS.ITEM_STATUS_CHANGED, refresh);
  useRealtimeReconnect(refresh);
}
