import { createBrowserRouter, type RouteObject } from 'react-router';
import { ForbiddenPage } from '../features/auth/ForbiddenPage';
import { HomeRedirect } from '../features/auth/HomeRedirect';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { RequireRole } from '../features/auth/RequireRole';
import { CashierHome } from '../features/role-home/CashierHome';
import { KitchenHome } from '../features/role-home/KitchenHome';
import { WaiterHome } from '../features/role-home/WaiterHome';
import { MenuPage } from '../features/menu/MenuPage';
import { UsersPage } from '../features/users/UsersPage';
import { AppShell } from './AppShell';

export const routes: RouteObject[] = [
  { path: '/ingresar', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            // Matriz de acceso de contracts/ui-routes.md (APP_ROUTES en @picanteria/shared).
            element: <RequireRole />,
            children: [
              { path: '/admin/usuarios', element: <UsersPage /> },
              { path: '/admin/carta', element: <MenuPage /> },
              { path: '/mozo', element: <WaiterHome /> },
              { path: '/cocina', element: <KitchenHome /> },
              { path: '/caja', element: <CashierHome /> },
            ],
          },
          { path: '/sin-permiso', element: <ForbiddenPage /> },
          { path: '*', element: <HomeRedirect /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
