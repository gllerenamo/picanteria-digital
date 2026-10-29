import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { CURRENT_USER_KEY } from '../features/auth/session';
import { ApiError } from '../lib/api-client';

export function createQueryClient(): QueryClient {
  // Si la sesión terminó (cerrada, expirada o revocada), se olvida al usuario y
  // RequireAuth lleva a /ingresar.
  // Si el rol cambió (FORBIDDEN), se vuelve a pedir el perfil para que el menú y
  // RequireRole reflejen el rol vigente (FR-012).
  const onError = (error: unknown) => {
    if (!(error instanceof ApiError)) return;
    if (error.code === 'UNAUTHENTICATED') {
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== CURRENT_USER_KEY[0] });
      client.setQueryData(CURRENT_USER_KEY, null);
    } else if (error.code === 'FORBIDDEN') {
      void client.invalidateQueries({ queryKey: CURRENT_USER_KEY });
    }
  };

  const client = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        // Los errores 4xx son definitivos; solo se reintentan los de red o del servidor.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
      },
    },
  });
  return client;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
