import { REALTIME_EVENTS } from '@picanteria/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useRealtimeEvent, useRealtimeReconnect } from '../../lib/realtime-context';
import { BILLING_KEYS } from './api';

/**
 * El evento avisa y la consulta manda: ante un cambio de mesa, una anulación o un cambio en la
 * cuenta hecho por otro cajero, y al reconectarse, se vuelven a pedir las cuentas
 * (contracts/websocket-events.md).
 */
export function useBillingRealtime(): void {
  const queryClient = useQueryClient();
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: BILLING_KEYS.all });
  }, [queryClient]);

  useRealtimeEvent(REALTIME_EVENTS.TABLE_STATUS_CHANGED, refresh);
  useRealtimeEvent(REALTIME_EVENTS.ITEM_VOIDED, refresh);
  useRealtimeEvent(REALTIME_EVENTS.BILLING_ACCOUNT_UPDATED, refresh);
  useRealtimeReconnect(refresh);
}
