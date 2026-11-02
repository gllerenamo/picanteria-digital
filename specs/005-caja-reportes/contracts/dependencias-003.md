# Dependencias con la feature 003 (mesas y pedidos)

**Feature**: 005-caja-reportes | Estado de la 003 en `main` al 2026-10-29 (PR #8): código de
US1 a US6 implementado (tomar el pedido, enviar a cocina, seguir lo enviado, anular y pedir la
cuenta); quedan 20 tareas, casi todas pruebas y Polish.

## Lo que Caja usa y ya existe en `main`

| Elemento | Dónde | Uso en Caja |
|----------|-------|-------------|
| Modelos `Order`, `OrderItem`, `ItemVoid`, `DiningTable` y sus enums | `apps/api/prisma/schema.prisma` | Datos de la cuenta y estados de mesa/pedido |
| Índice `orders_one_open_per_table` y `CHECK` de `order_items` | migración `20261029000002_orders` | Un pedido abierto por mesa; precio fijado al enviar |
| `consumptionCents`, `toCents`, `money`, `toOrderItem`, `ORDER_ITEM_INCLUDE` | `apps/api/src/orders/order-mapper.ts` | Mismo total que ve el mozo |
| `lockOpenOrder` | `apps/api/src/orders/order-locks.ts` | Serializar cobros con pedir la cuenta y con agregar a una mesa por cobrar (ambos lo usan) |
| `TablesService.transition(tx, tableId, from, to)` | `apps/api/src/menu/tables.service.ts` (exportado por `MenuModule`) | Mesa `POR_COBRAR → LIBRE` al cobrar |
| Decorador `IdempotencyKey` y código `IDEMPOTENCY_KEY_REUSED` | `apps/api/src/orders/idempotency-key.decorator.ts`, `packages/shared/src/errors.ts` | Pagos sin duplicar |
| `RealtimeGateway.emitToRoles` | `apps/api/src/realtime/realtime.gateway.ts` | Emitir mesa libre y `billing:account-updated` |
| `POST /orders/:orderId/request-bill` (`OCUPADA → POR_COBRAR`) | `orders.service.ts` | Origen de las mesas por cobrar (003 US6) |
| `POST /orders/:orderId/items` con `confirmReopen` (`POR_COBRAR → OCUPADA`) | `order-items.service.ts` | Mesa que vuelve a ocupada (AC-1.7, AC-2.6) |
| Evento `orders:table-status-changed` a `role:WAITER` y `role:CASHIER` | `orders.service.ts`, `order-items.service.ts` | Lista de mesas por cobrar en vivo |

## Pedidos a la 003 (no bloquean)

| Pedido | Motivo | Mientras tanto |
|--------|--------|----------------|
| Agregar `CASHIER` a los roles de `orders:item-voided` en `voids.service.ts` | Que la cuenta abierta en caja se refresque sola al anular | La caja vuelve a pedir la cuenta antes de cobrar; el backend valida contra el total vigente |

## Cómo prueba Caja

- **Pruebas de aceptación de la API**: preparan pedidos cobrables directamente en la base de
  pruebas (`createBillableOrder`), para no depender de las pruebas pendientes de la 003 y fijar
  casos exactos (unidades anuladas, precios distintos).
- **Pruebas e2e y recorrido manual**: usan el flujo real de la 003 (el mozo toma, envía y pide la
  cuenta), ya disponible en `main`.

## Acuerdos que Caja asume de la 003

- Al pedir la cuenta no quedan ítems `DRAFT` (003 AC-6.3; `HAS_UNSENT_ITEMS`).
- La 003 nunca pasa una mesa `POR_COBRAR` a `LIBRE` ni un pedido a `PAID` (003 AC-6.5).
- Agregar a una mesa por cobrar la pasa a `OCUPADA` dentro de `lockOpenOrder` (003 FR-034).
- El código `TABLE_AWAITING_PAYMENT` es de la 003 (agregar sin confirmar a una mesa por cobrar);
  Caja usa `BILL_NOT_REQUESTED` para "el mozo aún no pidió la cuenta".
