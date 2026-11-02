import {
  IDEMPOTENCY_KEY_HEADER,
  accountDetailSchema,
  accountSummarySchema,
  closureSummarySchema,
  dayClosureSchema,
  type ClosureCounts,
  type ConfirmClosureRequest,
  type CreatePaymentRequest,
  type CreateSplitRequest,
} from '@picanteria/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { z } from 'zod';
import { ApiError, requestJson } from '../../lib/api-client';
import { uuidV4 } from '../orders/pending-dispatch';

/** Todas las consultas de caja cuelgan de ['billing']: un evento las invalida juntas. */
export const BILLING_KEYS = {
  all: ['billing'] as const,
  accounts: ['billing', 'accounts'] as const,
  account: (orderId: string) => ['billing', 'accounts', orderId] as const,
  closures: ['billing', 'closures'] as const,
};

/** Mesas por cobrar (FR-001). */
export function usePendingAccounts() {
  return useQuery({
    queryKey: BILLING_KEYS.accounts,
    queryFn: () => requestJson('GET', '/api/billing/accounts', z.array(accountSummarySchema)),
  });
}

/** Cuenta de una mesa; se vuelve a pedir al recuperar el foco (la anulación de un ítem no llega a caja). */
export function useAccount(orderId: string) {
  return useQuery({
    queryKey: BILLING_KEYS.account(orderId),
    queryFn: () => requestJson('GET', `/api/billing/accounts/${orderId}`, accountDetailSchema),
    refetchOnWindowFocus: true,
  });
}

function useInvalidateBilling() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: BILLING_KEYS.all });
}

/** Errores tras los que el cobro no se reintenta con la misma clave. */
const isRetryable = (error: unknown): boolean =>
  error instanceof ApiError && (error.code === 'NETWORK_ERROR' || error.status >= 500);

/**
 * Registra un pago. Cada intento de cobro tiene su `Idempotency-Key`; si falla la conexión,
 * "Cobrar" otra vez con los mismos datos reutiliza la clave y no cobra dos veces (research.md §4).
 */
export function useCreatePayment(orderId: string) {
  const invalidate = useInvalidateBilling();
  const attempt = useRef<{ body: string; key: string } | null>(null);
  return useMutation({
    mutationFn: (input: CreatePaymentRequest) => {
      const body = JSON.stringify(input);
      if (attempt.current?.body !== body) attempt.current = { body, key: uuidV4() };
      return requestJson('POST', `/api/billing/accounts/${orderId}/payments`, accountDetailSchema, input, {
        [IDEMPOTENCY_KEY_HEADER]: attempt.current.key,
      });
    },
    onSuccess: () => {
      attempt.current = null;
    },
    onError: (error) => {
      if (!isRetryable(error)) attempt.current = null;
    },
    onSettled: invalidate,
  });
}

/** Cuenta por cobrar sin saldo (FR-009). */
export function useCloseWithoutCharge(orderId: string) {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: () => requestJson('POST', `/api/billing/accounts/${orderId}/close-without-charge`, accountDetailSchema),
    onSettled: invalidate,
  });
}

export function useCreateSplit(orderId: string) {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (input: CreateSplitRequest) =>
      requestJson('POST', `/api/billing/accounts/${orderId}/split`, accountDetailSchema, input),
    onSettled: invalidate,
  });
}

export function useVoidPayment(orderId: string) {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      requestJson('POST', `/api/billing/accounts/${orderId}/payments/${paymentId}/void`, accountDetailSchema, { reason }),
    onSettled: invalidate,
  });
}

/** Conteo a ciegas: lo registrado solo llega después de enviar lo contado (FR-016). */
export function usePreviewClosure() {
  return useMutation({
    mutationFn: (counts: ClosureCounts) => requestJson('POST', '/api/billing/closures/preview', closureSummarySchema, counts),
  });
}

export function useConfirmClosure() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (input: ConfirmClosureRequest) => requestJson('POST', '/api/billing/closures', dayClosureSchema, input),
    onSettled: invalidate,
  });
}

/** Historial de cierres, más reciente primero (FR-021). */
export function useClosures() {
  return useQuery({
    queryKey: BILLING_KEYS.closures,
    queryFn: () => requestJson('GET', '/api/billing/closures', z.array(dayClosureSchema)),
  });
}
