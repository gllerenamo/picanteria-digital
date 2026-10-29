# Contrato de tiempo real de mesas y pedidos (Socket.IO)

**Feature**: 003-mesas-pedidos | **Canal**: el de `001-base-comun`
([websocket-events.md](../../001-base-comun/contracts/websocket-events.md)): misma conexión
autenticada con la cookie `sid` y salas `user:<id>` y `role:<ROL>`. `ADMIN` está en todas las
salas de rol. No se crea otro gateway.

Los nombres y cargas se agregan a `packages/shared/src/events.ts` (`REALTIME_EVENTS` y
`ServerToClientEvents`). Todos los eventos se emiten **después** de confirmar la transacción,
con el ayudante `emitToRoles` de `RealtimeGateway` ([research.md §9](../research.md)).

Estos nombres reemplazan a `orders:created` y `orders:updated`, que la 001 había reservado. El
contrato de la 004 deja a la 003 fijar los nombres.

**Regla del cliente** (igual que la 004): los eventos avisan y la consulta manda. Ninguna
pantalla aplica parches con la carga: ante cualquier evento que la afecte, o al reconectarse,
vuelve a pedir el estado por la API. Así un evento perdido o repetido no deja la pantalla mal.

## Eventos que emite la 003

| Constante en `REALTIME_EVENTS` | Nombre | Salas | Lo emite |
|--------------------------------|--------|-------|----------|
| `DISPATCH_SENT` | `orders:dispatch-sent` | `role:KITCHEN`, `role:WAITER` | `POST /orders/{id}/dispatches` (solo la primera vez por clave) |
| `ITEM_VOIDED` | `orders:item-voided` | `role:KITCHEN`, `role:WAITER` | `POST /order-items/{id}/voids` |
| `TABLE_STATUS_CHANGED` | `orders:table-status-changed` | `role:WAITER`, `role:CASHIER` | Abrir, pedir la cuenta, agregar a una mesa por cobrar, cancelar la apertura (y Caja al cobrar, 005) |

### `orders:dispatch-sent`

Un envío a cocina quedó registrado (AC-3.2, 004 AC-1.3).

```ts
type DispatchSentPayload = {
  dispatchId: string;
  sequence: number;   // correlativo global; orden del tablero de cocina
  round: number;      // 1, 2, … dentro del pedido
  orderId: string;
  tableNumber: number;
  itemCount: number;  // ítems (líneas) del envío
  sentAt: string;     // ISO 8601
};
```

- **Cocina** vuelve a pedir `GET /api/kitchen/board`, resalta la comanda nueva y suena.
- **Mozos** vuelven a pedir `['orders']` (otro mozo pudo enviar en una mesa compartida).

### `orders:item-voided`

El administrador anuló unidades de un ítem enviado (AC-5.2, 004 AC-5.1, AC-5.2, AC-5.5).

```ts
type ItemVoidedPayload = {
  itemVoidId: string;
  orderItemId: string;
  dispatchId: string;
  tableNumber: number;
  units: number;              // unidades anuladas en esta anulación
  remainingQuantity: number;  // unidades que quedan por preparar; 0 = ítem VOIDED
  voidedAt: string;           // ISO 8601
};
```

- **Cocina** vuelve a pedir el tablero y muestra el aviso de anulación con "Entendido".
- **Mozos** vuelven a pedir el pedido para ver el ítem anulado (FR-031).

### `orders:table-status-changed`

Cambió el estado de una mesa (AC-1.3, AC-6.1, AC-6.6, AC-6.7).

```ts
type TableStatusChangedPayload = {
  tableId: string;
  tableNumber: number;
  status: 'LIBRE' | 'OCUPADA' | 'POR_COBRAR';
  orderId: string;    // el pedido que causó el cambio (también el cancelado o el cobrado)
  changedAt: string;  // ISO 8601
};
```

- **Mozos** vuelven a pedir `GET /api/orders/tables` y, si tienen abierto ese pedido,
  `GET /api/orders/{orderId}`.
- **Caja** (005) lo usa para enterarse de las mesas por cobrar. Al cobrar, Caja emite este
  mismo evento con `status: 'LIBRE'` (FR-036; dependencia P5 de [research.md §17](../research.md)).

## Eventos que escucha la vista del mozo

| Evento | Lo define | Para qué |
|--------|-----------|----------|
| `orders:dispatch-sent`, `orders:item-voided`, `orders:table-status-changed` | 003 | Volver a pedir mesas y pedido |
| `kitchen:item-status-changed` | 004 | Ver Pendiente → En preparación → Listo y los retrocesos por "Deshacer" sin recargar (AC-4.2, 004 E3) |
| `kitchen:ready-notice`, `kitchen:ready-notice-closed` | 004 | Los atiende la bandeja `ReadyNoticesTray` de cocina en el encabezado; la 003 no implementa un aviso propio (FR-027; 004 AC-3.1, AC-3.3 y AC-3.5) |
| `connect` (reconexión) | Socket.IO | Volver a pedir todo lo que muestra la pantalla (FR-038) |

La vista se suscribe con `useRealtimeEvent` sobre el socket compartido de `RealtimeProvider`
(`apps/web/src/lib/realtime-context.tsx`); no abre otra conexión.

## Garantías

- Ningún evento se emite si la transacción falla. El reintento idempotente de un envío no
  emite `orders:dispatch-sent` otra vez.
- Si el servidor cae entre el commit y la emisión, todos los clientes se reconectan y vuelven a
  consultar, así que el cambio se ve igual ([research.md §9](../research.md)).
- La pantalla del pedido, además, vuelve a consultar al recuperar el foco y cada 15 s mientras
  está abierta, para los cambios sin evento: disponibilidad de la carta y borradores de otro
  mozo ([research.md §10](../research.md)).
