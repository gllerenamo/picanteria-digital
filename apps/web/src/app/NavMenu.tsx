import { routesFor } from '@picanteria/shared';
import { NavLink } from 'react-router';
import { useCurrentUser } from '../features/auth/session';

/** Menú con las pantallas permitidas para el rol actual (AC-2.1). */
export function NavMenu() {
  const { data: user } = useCurrentUser();
  if (!user) return null;
  return (
    <nav aria-label="Menú principal">
      <ul className="flex flex-wrap gap-2">
        {routesFor(user.role).map((route) => (
          <li key={route.path}>
            <NavLink
              to={route.path}
              className={({ isActive }) =>
                `touch-target inline-flex items-center rounded-lg px-4 text-base font-medium ${
                  isActive ? 'bg-brand text-white' : 'border border-line bg-card active:bg-line'
                }`
              }
            >
              {route.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
