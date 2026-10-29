# Contrato de tiempo real de cocina (Socket.IO)

**Feature**: 004-cocina | **Canal**: el de `001-base-comun`
([websocket-events.md](../../001-base-comun/contracts/websocket-events.md)): misma conexión
autenticada y salas `user:<id>` y `role:<ROL>`. `ADMIN` está en todas las salas de rol.

Los nombres y cargas se agregan a `packages/shared/src/events.ts` (`REALTIME_EVENTS` y
`ServerToClientEvents`). Todos los eventos se emiten **después** de confirmar la transacción.

**Regla del cliente** ([research.md §6](../research.md)): los eventos avisan y la consulta
manda. La pantalla de cocina, ante cualquier evento que la afecte o al reconectarse, vuelve a
pedir `GET /api/kitchen/board`. No aplica parches locales, así nunca duplica ni pierde
comandas.

## Eventos que emite cocina

### `kitchen:item-status-changed`

**Salas**: `role:KITCHEN` y `role:WAITER`. Reemplaza el nombre reservado en la 001. Lo usan
las demás pantallas de cocina (AC-2.6) y la vista del mozo de la 003 (US4-AS2).

```ts
type ItemStatusChangedPayload = {
  orderItemId: string;
  dispatchId: string;
  tableNumber: number;
  status: 'PENDING' | 'PREPARING' | 'READY';
  previousStatus: 'PENDING' | 'PREPARING' | 'READY';
  isUndo: boolean;
  changedAt: string; // ISO 8601
};
```

### `kitchen:ready-notice`

**Sala**: `user:<mozo responsable>`, solo el destinatario (AC-3.1, AC-3.5).

```ts
type ReadyNoticePayload = {
  id: string;
  orderItemId: string;
  tableNumber: number;
  itemName: string;
  quantity: number;
  createdAt: string;
};
```

**Cliente**: la bandeja de avisos lo agrega y vuelve a pedir `GET /api/kitchen/ready-notices`.

### `kitchen:ready-notice-closed`

**Sala**: `user:<mozo responsable>`. Cierra el aviso en todos sus dispositivos.

```ts
type ReadyNoticeClosedPayload = {
  id: string;
  reason: 'SEEN' | 'UNDONE'; // el mozo tocó "Visto" | la cocina deshizo el "Listo"
};
```

### `kitchen:void-acknowledged`

**Sala**: `role:KITCHEN`. Quita el aviso de anulación de todas las pantallas de cocina (FR-027).

```ts
type VoidAcknowledgedPayload = { itemVoidId: string };
```

## Eventos que cocina escucha (los emite la 003)

Los nombres y cargas exactos los fija el contrato de la 003; cocina solo necesita que lleguen
a `role:KITCHEN`. Ante cualquiera de ellos, vuelve a pedir el tablero.

| Hecho | Nombre reservado en la 001 | Para qué lo usa cocina |
|-------|----------------------------|-------------------------|
| Envío confirmado | `orders:created` | Comanda nueva: resaltado y sonido (AC-1.3) |
| Ítem anulado (total o parcial) | `orders:updated` | Tachado, "N anulada(s)" y aviso con "Entendido" (AC-5.1, AC-5.2, AC-5.5) |

## Garantías

- Un evento perdido no deja la pantalla mal: al reconectarse se vuelve a pedir el tablero y los
  avisos (FR-017, FR-025).
- Un evento repetido no duplica nada: el tablero llega completo y ordenado por `sequence`.
- El cierre de un aviso (`SEEN`) es idempotente: tocar "Visto" dos veces no falla.
