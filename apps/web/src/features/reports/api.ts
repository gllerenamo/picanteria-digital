import { salesReportSchema, topDishSchema, type DateRangeQuery, type TopDishesSort } from '@picanteria/shared';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { requestJson } from '../../lib/api-client';

/** Rango de fechas `YYYY-MM-DD` (zona de Perú) de los reportes. */
export type DateRange = DateRangeQuery;

const query = (range: DateRange): string => new URLSearchParams({ from: range.from, to: range.to }).toString();

/** Ventas del rango (FR-022). */
export function useSalesReport(range: DateRange) {
  return useQuery({
    queryKey: ['reports', 'sales', range.from, range.to],
    queryFn: () => requestJson('GET', `/api/reports/sales?${query(range)}`, salesReportSchema),
  });
}

/** Ranking de platos del rango, por unidades o por monto (FR-023). */
export function useTopDishes(range: DateRange, sortBy: TopDishesSort) {
  return useQuery({
    queryKey: ['reports', 'top-dishes', range.from, range.to, sortBy],
    queryFn: () => requestJson('GET', `/api/reports/top-dishes?${query(range)}&sortBy=${sortBy}`, z.array(topDishSchema)),
  });
}
