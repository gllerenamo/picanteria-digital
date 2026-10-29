import { Navigate, Outlet } from 'react-router';
import { StatusMessage } from '../../components/StatusMessage';
import { NETWORK_ERROR_MESSAGE } from '../../lib/api-client';
import { useCurrentUser } from './session';

/** Sin sesión válida, cualquier pantalla interna redirige a /ingresar (AC-1.7). */
export function RequireAuth() {
  const { data: user, isPending, isError } = useCurrentUser();
  if (isPending) return <StatusMessage text="Cargando…" />;
  if (isError) return <StatusMessage text={NETWORK_ERROR_MESSAGE} />;
  if (!user) return <Navigate to="/ingresar" replace />;
  return <Outlet />;
}
