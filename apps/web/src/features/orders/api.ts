import {
  categoryWithItemsResponseSchema,
  orderDetailSchema,
  orderItemResponseSchema,
  tableOverviewSchema,
  type AddOrderItemRequest,
  type OpenOrderRequest,
  type UpdateOrderItemRequest,
} from '@picanteria/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { requestJson, requestVoid } from '../../lib/api-client';

/** Todas las consultas de la 003 cuelgan de ['orders']: un evento las invalida juntas. */
export const ORDERS_KEY = ['orders'] as const;
export const TABLES_KEY = ['orders', 'tables'] as const;
export const orderKey = (orderId: string) => ['orders', orderId] as const;

export function useTablesBoard() {
  return useQuery({
    queryKey: TABLES_KEY,
    queryFn: () => requestJson('GET', '/api/orders/tables', z.array(tableOverviewSchema)),
  });
}

/**
 * Pedido de una mesa. Además de los eventos, se vuelve a pedir al recuperar el foco y cada 15 s,
 * para ver la disponibilidad de la carta y los borradores de otro mozo (research.md §10).
 */
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: orderKey(orderId),
    queryFn: () => requestJson('GET', `/api/orders/${orderId}`, orderDetailSchema),
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
  });
}

function useInvalidateOrders() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
}

export function useOpenTable() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (input: OpenOrderRequest) => requestJson('POST', '/api/orders', orderDetailSchema, input),
    onSettled: invalidate,
  });
}

export function useUpdateGuests(orderId: string) {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (guestCount: number | null) =>
      requestJson('PATCH', `/api/orders/${orderId}`, orderDetailSchema, { guestCount }),
    onSettled: invalidate,
  });
}

/** Carta disponible para tomar pedidos (endpoint de la 002). */
export function useMenuForOrder() {
  return useQuery({
    queryKey: ['menu', 'available'],
    queryFn: () => requestJson('GET', '/api/menu/tree?availableOnly=true', z.array(categoryWithItemsResponseSchema)),
    refetchOnWindowFocus: true,
  });
}

export function useAddItem(orderId: string) {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (input: AddOrderItemRequest) =>
      requestJson('POST', `/api/orders/${orderId}/items`, orderItemResponseSchema, input),
    onSettled: invalidate,
  });
}

export function useUpdateItem() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateOrderItemRequest }) =>
      requestJson('PATCH', `/api/order-items/${itemId}`, orderItemResponseSchema, input),
    onSettled: invalidate,
  });
}

export function useRemoveItem() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (itemId: string) => requestVoid('DELETE', `/api/order-items/${itemId}`),
    onSettled: invalidate,
  });
}

export function useCancelOpening(orderId: string) {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: () => requestVoid('POST', `/api/orders/${orderId}/cancel`),
    onSettled: invalidate,
  });
}
