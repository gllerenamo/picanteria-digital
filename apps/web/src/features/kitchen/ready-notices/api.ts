import { REALTIME_EVENTS, readyNoticeSchema, type ReadyNotice } from '@picanteria/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { z } from 'zod';
import { requestJson, requestVoid } from '../../../lib/api-client';
import { useRealtimeEvent, useRealtimeReconnect } from '../../../lib/realtime-context';

/** Avisos de plato listo del mozo (specs/004-cocina/contracts/rest-api.yaml § Avisos al mozo). */
export const READY_NOTICES_KEY = ['kitchen', 'ready-notices'] as const;

export function useReadyNotices() {
  return useQuery({
    queryKey: READY_NOTICES_KEY,
    queryFn: () => requestJson('GET', '/api/kitchen/ready-notices', z.array(readyNoticeSchema)),
  });
}

/** Un aviso nuevo o cerrado, o una reconexión, vuelven a pedir la lista (FR-016, FR-017). */
export function useReadyNoticesRealtime(): void {
  const queryClient = useQueryClient();
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: READY_NOTICES_KEY });
  }, [queryClient]);
  useRealtimeEvent(REALTIME_EVENTS.READY_NOTICE, refresh);
  useRealtimeEvent(REALTIME_EVENTS.READY_NOTICE_CLOSED, refresh);
  useRealtimeReconnect(refresh);
}

/** "Visto": el aviso desaparece al tocar, sin esperar a la API. */
export function useMarkSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noticeId: string) => requestVoid('POST', `/api/kitchen/ready-notices/${noticeId}/seen`),
    onMutate: (noticeId) => {
      queryClient.setQueryData<ReadyNotice[]>(READY_NOTICES_KEY, (notices) => notices?.filter((notice) => notice.id !== noticeId));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: READY_NOTICES_KEY }),
  });
}
