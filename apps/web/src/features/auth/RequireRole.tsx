import { appRouteFor, canAccess } from '@picanteria/shared';
import { Outlet, useLocation } from 'react-router';
import { ForbiddenPage } from './ForbiddenPage';
import { useCurrentUser } from './session';

/**
 * Protege las pantallas de rol según la matriz de @picanteria/shared. Si no hay permiso,
 * muestra el aviso sin montar la pantalla pedida (y sin cargar sus datos).
 */
export function RequireRole() {
  const { data: user } = useCurrentUser();
  const { pathname } = useLocation();
  if (!user) return null;
  if (appRouteFor(pathname) && !canAccess(user.role, pathname)) return <ForbiddenPage />;
  return <Outlet />;
}
