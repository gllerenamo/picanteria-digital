import type { PaymentMethod } from '@picanteria/shared';

/** Cálculos de caja sin acceso a datos, en céntimos enteros (research.md §3 y §6; probados en billing-math.spec.ts). */

/** Reparte el saldo en `parts` partes: ⌊saldo / n⌋ cada una y los céntimos sobrantes a la parte 1. */
export function splitEqually(pendingCents: number, parts: number): number[] {
  const base = Math.floor(pendingCents / parts);
  const remainder = pendingCents - base * parts;
  return Array.from({ length: parts }, (_, index) => (index === 0 ? base + remainder : base));
}

export interface AssignedUnits {
  orderItemId: string;
  units: number;
}

export interface AssignmentCheck {
  /** Unidades disponibles que ninguna parte tomó, por ítem. */
  unassigned: Record<string, number>;
  /** Unidades asignadas por encima de las disponibles, por ítem. */
  overAssigned: Record<string, number>;
  /** Ítems que no son de esta cuenta (o ya no tienen unidades por pagar). */
  unknown: string[];
  unassignedTotal: number;
}

/**
 * Compara lo asignado en una división por ítems con las unidades vigentes no pagadas de cada
 * ítem (`available`): todas deben asignarse y ninguna más de una vez (FR-011, AC-2.2).
 */
export function validateAssignment(
  available: ReadonlyMap<string, number>,
  parts: ReadonlyArray<{ items: readonly AssignedUnits[] }>,
): AssignmentCheck {
  const assigned = new Map<string, number>();
  const unknown = new Set<string>();
  for (const part of parts) {
    for (const { orderItemId, units } of part.items) {
      if (!available.has(orderItemId)) unknown.add(orderItemId);
      assigned.set(orderItemId, (assigned.get(orderItemId) ?? 0) + units);
    }
  }

  const unassigned: Record<string, number> = {};
  const overAssigned: Record<string, number> = {};
  let unassignedTotal = 0;
  for (const [orderItemId, units] of available) {
    const difference = units - (assigned.get(orderItemId) ?? 0);
    if (difference > 0) {
      unassigned[orderItemId] = difference;
      unassignedTotal += difference;
    } else if (difference < 0) {
      overAssigned[orderItemId] = -difference;
    }
  }
  return { unassigned, overAssigned, unknown: [...unknown], unassignedTotal };
}

/** Monto de una parte por ítems: Σ unidades × precio con que se envió cada ítem. */
export function assignedAmountCents(items: readonly AssignedUnits[], unitPrices: ReadonlyMap<string, number>): number {
  return items.reduce((total, { orderItemId, units }) => total + units * (unitPrices.get(orderItemId) ?? 0), 0);
}

/** Vuelto de un pago en efectivo; negativo si lo recibido no alcanza. */
export function changeCents(amountCents: number, receivedCents: number): number {
  return receivedCents - amountCents;
}

export type MethodAmounts = Record<PaymentMethod, number>;

export interface ClosureLineCents {
  method: PaymentMethod;
  expected: number;
  counted: number;
  /** Contado − registrado: positivo = sobrante, negativo = faltante. */
  difference: number;
}

const METHOD_ORDER: readonly PaymentMethod[] = ['CASH', 'YAPE_PLIN', 'CARD'];

/** Registrado, contado y diferencia por método, en el orden Efectivo, Yape/Plin, Tarjeta (FR-017). */
export function closureLines(
  expected: MethodAmounts,
  counted: MethodAmounts,
): { lines: ClosureLineCents[]; hasDifferences: boolean } {
  const lines = METHOD_ORDER.map((method) => ({
    method,
    expected: expected[method],
    counted: counted[method],
    difference: counted[method] - expected[method],
  }));
  return { lines, hasDifferences: lines.some((line) => line.difference !== 0) };
}

/**
 * Una división queda desactualizada si el saldo que repartió ya no es el saldo que le
 * corresponde: cambió el total (agregados o anulaciones) o cambiaron los pagos que no son de sus
 * partes (research.md §6, AC-2.6).
 */
export function isSplitStale(totalCents: number, baseCents: number, paidOutsideSplitCents: number): boolean {
  return totalCents - paidOutsideSplitCents !== baseCents;
}
