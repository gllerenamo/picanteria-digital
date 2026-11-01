import { createBrowserRouter, type RouteObject } from 'react-router';
import { ForbiddenPage } from '../features/auth/ForbiddenPage';
import { HomeRedirect } from '../features/auth/HomeRedirect';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { RequireRole } from '../features/auth/RequireRole';
import { AccountPage } from '../features/billing/AccountPage';
import { ClosurePage } from '../features/billing/ClosurePage';
import { ClosuresHistoryPage } from '../features/billing/ClosuresHistoryPage';
import { PendingAccountsPage } from '../features/billing/PendingAccountsPage';
import { KitchenBoardPage } from '../features/kitchen/KitchenBoardPage';
import { MenuPage } from '../features/menu/MenuPage';
import { OrderPage } from '../features/orders/OrderPage';
import { TablesBoardPage } from '../features/orders/TablesBoardPage';
import { ReportsPage } from '../features/reports/ReportsPage';
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
              { path: '/admin/reportes', element: <ReportsPage /> },
              { path: '/mozo', element: <TablesBoardPage /> },
              { path: '/mozo/pedidos/:orderId', element: <OrderPage /> },
              { path: '/cocina', element: <KitchenBoardPage /> },
              { path: '/caja', element: <PendingAccountsPage /> },
              { path: '/caja/cuentas/:orderId', element: <AccountPage /> },
              { path: '/caja/cierre', element: <ClosurePage /> },
              { path: '/caja/cierres', element: <ClosuresHistoryPage /> },
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
