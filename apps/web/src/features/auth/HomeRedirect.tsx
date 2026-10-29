import { Navigate } from 'react-router';
import { useCurrentUser } from './session';

/** Rutas inexistentes: a la pantalla inicial del rol, o a /ingresar sin sesión. */
export function HomeRedirect() {
  const { data: user } = useCurrentUser();
  return <Navigate to={user?.homePath ?? '/ingresar'} replace />;
}
