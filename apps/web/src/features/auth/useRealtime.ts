import { REALTIME_EVENTS, appRouteFor, canAccess, type CurrentUser } from '@picanteria/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { RealtimeState, RealtimeStatus } from '../../lib/realtime-context';
import { connectRealtime, type RealtimeSocket } from '../../lib/socket';
import { ACCOUNT_DISABLED_NOTICE, setLoginNotice } from './login-notice';
import { CURRENT_USER_KEY, clearSession, useCurrentUser } from './session';

/**
 * Mantiene la conexión de tiempo real mientras hay sesión y aplica al instante los cambios
 * que hace el administrador (contracts/websocket-events.md). Devuelve el socket y su estado
 * para compartirlos con `RealtimeProvider` (lib/realtime-context.tsx).
 */
export function useRealtime(): RealtimeState {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  const userId = user?.id;
  const [socketState, setSocketState] = useState<RealtimeSocket | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!userId) return;
    const socket = connectRealtime();
    setSocketState(socket);
    socket.on('connect', () => {
      setStatus('connected');
    });
    socket.on('connect_error', () => {
      setStatus('disconnected');
    });

    socket.on(REALTIME_EVENTS.SESSION_REVOKED, ({ reason }) => {
      socket.disconnect();
      if (reason === 'USER_DISABLED') setLoginNotice(ACCOUNT_DISABLED_NOTICE);
      // Sin usuario en caché, RequireAuth lleva a /ingresar.
      clearSession(queryClient);
    });

    socket.on(REALTIME_EVENTS.PROFILE_CHANGED, () => {
      // invalidateQueries espera a que se vuelva a pedir el perfil antes de continuar.
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY }).then(() => {
        const fresh = queryClient.getQueryData<CurrentUser | null>(CURRENT_USER_KEY);
        const path = pathRef.current;
        if (fresh && appRouteFor(path) && !canAccess(fresh.role, path)) {
          void navigate(fresh.homePath, { replace: true });
        }
      });
    });

    // Respaldo: si el servidor cerró la conexión, se vuelve a pedir el perfil; sin sesión
    // válida, RequireAuth lleva a /ingresar.
    socket.on('disconnect', (reason) => {
      setStatus('disconnected');
      if (reason === 'io server disconnect') {
        void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
      }
    });

    return () => {
      socket.disconnect();
      setSocketState(null);
      setStatus('connecting');
    };
  }, [userId, queryClient, navigate]);

  return { socket: socketState, status };
}
