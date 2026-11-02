import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes, type RouteObject } from 'react-router';
import { createQueryClient } from '../src/app/providers';

function testQueryClient() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } });
  return client;
}

/** Renderiza rutas con un QueryClient nuevo y un router en memoria. */
export function renderRoutes(routes: RouteObject[], initialPath: string): RenderResult & { router: ReturnType<typeof createMemoryRouter> } {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const result = render(
    <QueryClientProvider client={testQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, router };
}

/**
 * Igual que `renderRoutes`, con el router declarativo: para pantallas que navegan solas
 * (`navigate`), porque en jsdom la navegación del router de datos falla al crear su `Request`.
 */
export function renderNavigableRoutes(routes: Array<{ path: string; element: React.ReactNode }>, initialPath: string): RenderResult {
  return render(
    <QueryClientProvider client={testQueryClient()}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
