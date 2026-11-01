import { REALTIME_EVENTS, kitchenBoardSchema, ticketItemSchema, type AdvanceItemRequest, type UndoItemRequest } from '@picanteria/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { requestJson, requestVoid } from '../../lib/api-client';
import { useRealtimeEvent, useRealtimeReconnect } from '../../lib/realtime-context';

/** Tablero de cocina (specs/004-cocina/contracts/rest-api.yaml). */
export const BOARD_KEY = ['kitchen', 'board'] as const;

export function useKitchenBoard() {
  return useQuery({
    queryKey: BOARD_KEY,
    queryFn: () => requestJson('GET', '/api/kitchen/board', kitchenBoardSchema),
  });
}

function useRefreshBoard(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: BOARD_KEY });
  }, [queryClient]);
}

/**
 * El evento avisa y la consulta manda: ante un envío, una anulación, un cambio de estado o un
 * "Entendido", y al reconectarse, se vuelve a pedir el tablero completo (research.md §6). Así
 * ninguna comanda se duplica ni se pierde (FR-007, FR-025).
 */
export function useKitchenRealtime(): void {
  const refresh = useRefreshBoard();
  useRealtimeEvent(REALTIME_EVENTS.DISPATCH_SENT, refresh);
  useRealtimeEvent(REALTIME_EVENTS.ITEM_VOIDED, refresh);
  useRealtimeEvent(REALTIME_EVENTS.ITEM_STATUS_CHANGED, refresh);
  useRealtimeEvent(REALTIME_EVENTS.VOID_ACKNOWLEDGED, refresh);
  useRealtimeReconnect(refresh);
}

export function useAdvanceItem() {
  const refresh = useRefreshBoard();
  return useMutation({
    mutationFn: ({ itemId, from }: { itemId: string } & AdvanceItemRequest) =>
      requestJson('POST', `/api/kitchen/items/${itemId}/advance`, ticketItemSchema, { from }),
    onSettled: refresh,
  });
}

export function useUndoItem() {
  const refresh = useRefreshBoard();
  return useMutation({
    mutationFn: ({ itemId, from }: { itemId: string } & UndoItemRequest) =>
      requestJson('POST', `/api/kitchen/items/${itemId}/undo`, ticketItemSchema, { from }),
    onSettled: refresh,
  });
}

export function useAcknowledgeVoid() {
  const refresh = useRefreshBoard();
  return useMutation({
    mutationFn: (itemVoidId: string) => requestVoid('POST', `/api/kitchen/void-notices/${itemVoidId}/ack`),
    onSettled: refresh,
  });
}
