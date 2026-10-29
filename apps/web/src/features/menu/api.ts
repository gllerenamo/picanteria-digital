import {
  categoryResponseSchema,
  categoryWithItemsResponseSchema,
  menuItemResponseSchema,
  type CategoryResponse,
  type CategoryWithItemsResponse,
  type CreateCategoryRequest,
  type CreateMenuItemRequest,
  type MenuItemResponse,
  type UpdateMenuItemRequest,
} from '@picanteria/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { requestJson } from '../../lib/api-client';

export const MENU_KEY = ['menu'] as const;
export const MENU_CATEGORIES_KEY = ['menu', 'categories'] as const;

export function useMenuTree(availableOnly = false) {
  return useQuery<CategoryWithItemsResponse[]>({
    queryKey: [...MENU_KEY, 'tree', { availableOnly }],
    queryFn: () =>
      requestJson(
        'GET',
        `/api/menu/tree${availableOnly ? '?availableOnly=true' : ''}`,
        z.array(categoryWithItemsResponseSchema),
      ),
  });
}

export function useCategories() {
  return useQuery<CategoryResponse[]>({
    queryKey: MENU_CATEGORIES_KEY,
    queryFn: () => requestJson('GET', '/api/menu/categories', z.array(categoryResponseSchema)),
  });
}

export function useMenuItems(categoryId?: string, availableOnly = false) {
  return useQuery<MenuItemResponse[]>({
    queryKey: [...MENU_KEY, 'items', { categoryId, availableOnly }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (categoryId) params.set('categoryId', categoryId);
      if (availableOnly) params.set('availableOnly', 'true');
      const qs = params.toString() ? `?${params.toString()}` : '';
      return requestJson('GET', `/api/menu/items${qs}`, z.array(menuItemResponseSchema));
    },
  });
}

function useInvalidateMenu() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: MENU_KEY });
  };
}

export function useCreateCategory() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: (input: CreateCategoryRequest) =>
      requestJson('POST', '/api/menu/categories', categoryResponseSchema, input),
    onSuccess: invalidate,
  });
}

export function useCreateMenuItem() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: (input: CreateMenuItemRequest) =>
      requestJson('POST', '/api/menu/items', menuItemResponseSchema, input),
    onSuccess: invalidate,
  });
}

export function useUpdateMenuItem() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMenuItemRequest }) =>
      requestJson('PUT', `/api/menu/items/${id}`, menuItemResponseSchema, input),
    onSuccess: invalidate,
  });
}

export function useToggleItemAvailability() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable?: boolean }) =>
      requestJson('PATCH', `/api/menu/items/${id}/availability`, menuItemResponseSchema, { isAvailable }),
    onSuccess: invalidate,
  });
}

export function useSetItemActive() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      requestJson('PATCH', `/api/menu/items/${id}/status`, menuItemResponseSchema, { isActive }),
    onSuccess: invalidate,
  });
}
