import { userSchema, type CreateUserRequest, type UpdateUserRequest } from '@picanteria/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { requestJson, requestVoid } from '../../lib/api-client';

export const USERS_KEY = ['users'] as const;

export function useUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: () => requestJson('GET', '/api/users', z.array(userSchema)),
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: USERS_KEY });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (input: CreateUserRequest) => requestJson('POST', '/api/users', userSchema, input),
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserRequest }) =>
      requestJson('PATCH', `/api/users/${id}`, userSchema, input),
    onSuccess: invalidate,
  });
}

export function useSetPassword() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      requestVoid('PUT', `/api/users/${id}/password`, { password }),
    onSuccess: invalidate,
  });
}

export function useSetStatus() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      requestJson('PATCH', `/api/users/${id}/status`, userSchema, { isActive }),
    onSuccess: invalidate,
  });
}
