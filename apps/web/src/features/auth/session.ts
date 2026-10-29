import { currentUserSchema, type CurrentUser, type LoginRequest } from '@picanteria/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ApiError, requestJson, requestVoid } from '../../lib/api-client';

export const CURRENT_USER_KEY = ['auth', 'me'] as const;

/**
 * Olvida la sesión: primero fija el usuario en `null` (los componentes montados se enteran y
 * RequireAuth lleva a /ingresar) y luego borra el resto de datos en caché. Eliminar la consulta
 * del usuario dejaría a los componentes montados con la copia anterior.
 */
export function clearSession(queryClient: QueryClient): void {
  queryClient.setQueryData(CURRENT_USER_KEY, null);
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== CURRENT_USER_KEY[0] });
}

/** Usuario de la sesión actual, o `null` si no hay sesión válida. */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await requestJson('GET', '/api/auth/me', currentUserSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: fetchCurrentUser,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginRequest) => requestJson('POST', '/api/auth/login', currentUserSchema, input),
    onSuccess: (user) => {
      queryClient.setQueryData(CURRENT_USER_KEY, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestVoid('POST', '/api/auth/logout'),
    onSettled: () => {
      clearSession(queryClient);
    },
  });
}
