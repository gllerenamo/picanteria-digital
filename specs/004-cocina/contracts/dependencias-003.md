# Lo que cocina necesita de 003-mesas-pedidos

**Para**: el responsable de `003-mesas-pedidos` | **Estado**: por conciliar con el contrato de
eventos de la 003.

Esta lista es la que se usa para revisar el contrato de la 003 antes de que la 004 implemente.
Los nombres en código son propuestas: si la 003 elige otros, solo cambian aquí y en
[data-model.md](../data-model.md) §4.

## Datos

| # | Necesidad | Propuesta | Spec 004 |
|---|-----------|-----------|----------|
| D1 | Cada envío tiene un número correlativo único y global que fija el orden | `KitchenDispatch.sequence` (único) | FR-001, AC-1.2 |
| D2 | Cada envío sabe qué ronda es de su mesa | `KitchenDispatch.round` (1, 2, …) | FR-004, AC-1.5 |
| D3 | Un reintento del mozo no crea un segundo envío | Clave de idempotencia única en `KitchenDispatch` | FR-007, AC-1.6 |
| D4 | El envío registra quién lo mandó y cuándo | `sentById`, `sentAt` | AC-1.4 |
| D5 | El pedido sabe quién es el mozo responsable | `Order.waiterId` (el que abrió la mesa) | FR-015, AC-3.5 |
| D6 | El ítem guarda cuántas unidades se anularon | `OrderItem.voidedQuantity` | FR-023, AC-5.2 |
| D7 | Cada anulación es una fila con sus unidades | `ItemVoid(id, orderItemId, units, reason, voidedById, voidedAt)` | FR-027, AC-5.5 |
| D8 | El estado del ítem usa valores comunes | `OrderItemStatus`: `DRAFT`, `PENDING`, `PREPARING`, `READY`, `VOIDED` | FR-008 |
| D9 | Todo lo enviado llega a cocina, bebidas incluidas | Sin filtro por categoría | FR-002, AC-1.7 |
| D10 | Un ítem en `READY` no se anula | Regla de la 003 (FR-030) | Edge case |

## Eventos

| # | Necesidad | Spec 004 |
|---|-----------|----------|
| E1 | Al confirmar un envío, un evento a `role:KITCHEN` | AC-1.3 |
| E2 | Al anular (total o parcial), un evento a `role:KITCHEN` | AC-5.1, AC-5.2, AC-5.5 |
| E3 | La vista del mozo escucha `kitchen:item-status-changed` para mostrar estados, incluidos los **retrocesos** por "Deshacer" | AC-2.5 |

## Avisos de plato listo

| # | Acuerdo propuesto | Spec 004 |
|---|-------------------|----------|
| A1 | El aviso lo crea y lo guarda cocina; la 003 no implementa uno propio | FR-015 |
| A2 | La bandeja `ReadyNoticesTray` de cocina se muestra en el encabezado para el rol mozo, en cualquier pantalla | AC-3.1, 003 US4-AS3 |
| A3 | El botón del aviso dice "Visto" (`003` FR-027) | AC-3.2 |
| A4 | Si la cocina deshace un "Listo" no visto, el aviso se retira | AC-3.4 |
