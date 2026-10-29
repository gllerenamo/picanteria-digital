import { Outlet, useNavigate } from 'react-router';
import { useCurrentUser, useLogout } from '../features/auth/session';
import { useRealtime } from '../features/auth/useRealtime';
import { NavMenu } from './NavMenu';

/** Marco de las pantallas internas: encabezado con el usuario y "Cerrar sesión" (FR-006). */
export function AppShell() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  useRealtime();

  const onLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        void navigate('/ingresar');
      },
    });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-wide text-brand uppercase">Picantería Digital</p>
            <p className="truncate text-base text-muted">{user?.fullName}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            disabled={logout.isPending}
            className="touch-target rounded-lg border border-line px-4 text-base font-medium active:bg-line disabled:opacity-60"
          >
            Cerrar sesión
          </button>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3">
          <NavMenu />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
