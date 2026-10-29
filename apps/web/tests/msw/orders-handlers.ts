import type { ApiErrorBody, CategoryWithItemsResponse, OrderDetail, TableOverview } from '@picanteria/shared';
import { http, HttpResponse } from 'msw';
import { server } from './server';

/** Manejadores de /api/orders, /api/order-items y la carta para las pruebas de la 003. */

/** `GET /api/orders/tables`; con una función, cada llamada puede devolver otro tablero. */
export function mockTablesBoard(tables: TableOverview[] | (() => TableOverview[])): void {
  server.use(http.get('*/api/orders/tables', () => HttpResponse.json(typeof tables === 'function' ? tables() : tables)));
}

/** `GET /api/orders/:id`. */
export function mockOrder(order: OrderDetail | (() => OrderDetail)): void {
  const resolve = (): OrderDetail => (typeof order === 'function' ? order() : order);
  server.use(http.get(`*/api/orders/${resolve().id}`, () => HttpResponse.json(resolve())));
}

/** `GET /api/menu/tree?availableOnly=true` (carta de la 002). */
export function mockMenuTree(tree: CategoryWithItemsResponse[]): void {
  server.use(http.get('*/api/menu/tree', () => HttpResponse.json(tree)));
}

/** Respuesta de error de la API con su código y mensaje en español. */
export function apiError(status: number, body: ApiErrorBody): Response {
  return HttpResponse.json(body, { status });
}
