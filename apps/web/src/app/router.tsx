import { createBrowserRouter, type RouteObject } from 'react-router';
import { ForbiddenPage } from '../features/auth/ForbiddenPage';
import { HomeRedirect } from '../features/auth/HomeRedirect';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { RequireRole } from '../features/auth/RequireRole';
import { KitchenBoardPage } from '../features/kitchen/KitchenBoardPage';
import { CashierHome } from '../features/role-home/CashierHome';
import { MenuPage } from '../features/menu/MenuPage';
import { OrderPage } from '../features/orders/OrderPage';
import { TablesBoardPage } from '../features/orders/TablesBoardPage';
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
              { path: '/mozo', element: <TablesBoardPage /> },
              { path: '/mozo/pedidos/:orderId', element: <OrderPage /> },
              { path: '/cocina', element: <KitchenBoardPage /> },
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
