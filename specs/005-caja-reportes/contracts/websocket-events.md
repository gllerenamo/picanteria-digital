# Contrato de tiempo real: Caja

**Feature**: 005-caja-reportes | Canal y autenticación: [001 websocket-events](../../001-base-comun/contracts/websocket-events.md)

## Eventos que Caja escucha

| Evento | Origen | Uso en Caja |
|--------|--------|-------------|
| `orders:table-status-changed` | 003 (y la propia Caja) | Agregar a la lista una mesa que pasa a `POR_COBRAR` (AC-1.1); bloquear el cobro si la cuenta abierta vuelve a `OCUPADA` (AC-1.7); quitar de la lista una mesa `LIBRE`. |
| `orders:item-voided` | 003 | Volver a pedir la cuenta abierta: el total cambió (la división puede quedar desactualizada). **Pendiente de la 003**: hoy lo emite solo a `role:KITCHEN` y `role:WAITER`; se le pide agregar `role:CASHIER` en `voids.service.ts`. Mientras tanto, la pantalla de caja vuelve a pedir la cuenta al abrir el formulario de pago, y el backend rechaza cualquier pago calculado sobre un total anterior. |
| `billing:account-updated` | 005 | Refrescar la cuenta abierta y la lista cuando otro cajero registra o anula un pago, o divide la cuenta. |

## Eventos que Caja emite

### `orders:table-status-changed` (contrato de la 003)

Al completar el pago o cerrar sin cobro, Caja emite el payload de la 003 con `status: 'LIBRE'` y
el `orderId` cobrado a las salas `role:WAITER` y `role:CASHIER` (003 AC-6.6, FR-008).

### `billing:account-updated` (nuevo)

Sala `role:CASHIER` (el administrador también está en ella).

```ts
interface AccountUpdatedPayload {
  orderId: string;
  tableNumber: number;
  reason: 'PAYMENT_CREATED' | 'PAYMENT_VOIDED' | 'SPLIT_CREATED' | 'PAID' | 'CLOSED_WITHOUT_CHARGE';
  pending: { amount: number; formatted: string };
  changedAt: string;
}
```

Se agrega a `REALTIME_EVENTS` y a `ServerToClientEvents` en `packages/shared/src/events.ts`.

## Garantías

- Los eventos mejoran la experiencia; la garantía la da el backend: cada pago se valida contra
  el estado y el saldo actuales bajo el bloqueo del pedido ([research.md §5](../research.md)).
- Tras reconectar, la pantalla de caja vuelve a pedir la lista y la cuenta abierta.
