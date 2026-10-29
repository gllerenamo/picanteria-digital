---

description: "Lista de tareas de la feature 003-mesas-pedidos"
---

# Tasks: Mesas y pedidos (Módulo 2)

**Input**: Design documents from `/specs/003-mesas-pedidos/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: OBLIGATORIAS (Principio II). Cada prueba de aceptación lleva en su título el
prefijo de la feature y el ID del criterio: `"[003] AC-3.9: …"`. Las pruebas de cada historia
se escriben primero y deben fallar antes de implementar. Los avisos de plato listo son
criterios de la 004 ([research.md §16](research.md)).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Rama**: todo el trabajo va en la rama `003-mesas-pedidos` y se integra con un único PR al
terminar, revisado por Paolo.

**Coordinación con la 004**: `emitToRoles`, `realtime-context.tsx`, `ConnectionBanner` y la
constante de `kitchen:item-status-changed` también los plantea la 004. La tarea que los toca
primero comprueba si ya están en `main` y, si están, los reutiliza sin duplicarlos
([research.md §17](research.md), P6).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monorepo de la 001: `apps/api/` (NestJS), `apps/web/` (React + Vite), `packages/shared/`.
Textos visibles en español; identificadores de código en inglés.

---

## Phase 1: Setup

**Purpose**: dejar la rama lista y el esqueleto del módulo registrado.

- [X] T001 Actualizar la rama `003-mesas-pedidos` con `main` y confirmar en `apps/api/prisma/schema.prisma` que `DiningTable` (`tableNumber`, `status LIBRE | OCUPADA | POR_COBRAR`) y `MenuItem` (`price`, `isAvailable`, `isActive`) siguen como en [data-model.md](data-model.md); anotar si `emitToRoles`, `apps/web/src/lib/realtime-context.tsx`, `apps/web/src/components/ConnectionBanner.tsx` o `kitchen:item-status-changed` ya existen (la 004 pudo integrarse antes)
- [X] T002 [P] Crear `apps/api/src/orders/orders.module.ts` (importa `PrismaModule`, `MenuModule` y `RealtimeModule`; sin controladores aún) y registrarlo en `apps/api/src/app.module.ts`
- [X] T003 [P] Agregar a `apps/api/prisma/e2e-users.json` un segundo mozo (`"key": "mozo2"`, `"username": "mozo2.e2e"`, `"fullName": "Segundo Mozo de Pruebas"`, `"role": "WAITER"`) y ampliar el tipo `E2eUserKey` en `apps/web/e2e/helpers/auth.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: datos, contratos compartidos, bloqueos, tiempo real y ayudantes de prueba que
usan todas las historias.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

- [X] T004 Agregar a `apps/api/prisma/schema.prisma` los enums `OrderStatus` (`OPEN`, `PAID`, `CANCELLED`) y `OrderItemStatus` (`DRAFT`, `PENDING`, `PREPARING`, `READY`, `VOIDED`) y los modelos de [data-model.md §1](data-model.md), con UUID, `Timestamptz(3)`, `@@map` en snake_case y `onDelete: Restrict`: `Order` (`tableId`, `waiterId`, `guestCount Int?`, `status @default(OPEN)`, `createdAt`, `updatedAt`, `closedAt?`; índices `tableId`, `waiterId`, `status`); `OrderItem` (`orderId`, `dispatchId?`, `menuItemId`, `quantity`, `voidedQuantity @default(0)`, `unitPrice Decimal(10,2)?`, `notes VarChar(140)?`, `status @default(DRAFT)`; índices `(orderId, status)` y `dispatchId`); `KitchenDispatch` (`orderId`, `sequence Int @unique`, `round`, `idempotencyKey Uuid @unique`, `sentById`, `sentAt @default(now())`; `@@unique([orderId, round])`); `ItemVoid` (`orderItemId`, `units`, `reason VarChar(200)`, `voidedById`, `voidedAt @default(now())`; índice `orderItemId`). Agregar solo campos de relación inversa en `User` (`ordersOpened`, `dispatchesSent`, `itemVoids`, con nombre de relación), `DiningTable` (`orders`) y `MenuItem` (`orderItems`) ([data-model.md §5](data-model.md))
- [X] T005 Generar la migración `apps/api/prisma/migrations/<fecha>_orders/migration.sql` con `prisma migrate dev --create-only` y añadir a mano: `CREATE UNIQUE INDEX orders_one_open_per_table ON orders (table_id) WHERE status = 'OPEN'` y los `CHECK` de `order_items`: `quantity >= 1`, `voided_quantity >= 0 AND voided_quantity <= quantity`, `(status = 'DRAFT') = (dispatch_id IS NULL)`, `(status = 'DRAFT') = (unit_price IS NULL)` (depende de T004)
- [X] T006 [P] Agregar a `packages/shared/src/errors.ts` (en `ERROR_CODES` y en `ERROR_MESSAGES`): `TABLE_NOT_AVAILABLE` ("La mesa ya no está libre"), `TABLE_STATE_CONFLICT` ("La mesa cambió de estado. Revisa su estado actual."), `ORDER_NOT_OPEN` ("Este pedido ya está cerrado"), `TABLE_AWAITING_PAYMENT` ("La mesa está por cobrar. Confirma para volver a abrirla y agregar."), `MENU_ITEM_UNAVAILABLE` ("Este plato ya no está disponible"), `ITEM_ALREADY_SENT` ("Este ítem ya se envió a cocina; solo el administrador puede anularlo"), `NOTHING_TO_SEND` ("No hay nada nuevo que enviar"), `ITEMS_UNAVAILABLE` ("Algunos platos ya no están disponibles. Quítalos o cámbialos para enviar."), `IDEMPOTENCY_KEY_REUSED` ("La solicitud no es válida. Recarga la página e inténtalo de nuevo."), `ITEM_NOT_VOIDABLE` ("Este ítem ya no se puede anular"), `HAS_UNSENT_ITEMS` ("Hay ítems sin enviar. Envíalos o quítalos antes de pedir la cuenta."), `NO_CONSUMPTION` ("La mesa no tiene consumo. Si se abrió por error, cancela la apertura."), `CANCEL_NOT_ALLOWED` ("No se puede cancelar: esta mesa ya tiene pedidos enviados a cocina.")
- [X] T007 [P] Crear `packages/shared/src/schemas/orders.ts` y exportarlo en `packages/shared/src/index.ts`. Peticiones, con los mensajes en español: `openOrderSchema` (`tableId` UUID, `guestCount` "entero 1–50, opcional, nulo"), `updateOrderSchema` (`guestCount` "entero 1–50 o nulo"), `addOrderItemSchema` (`menuItemId` UUID, `quantity` "entero 1–99", `notes` "texto ≤ 140, opcional" con `trim` y vacío → `null`, `confirmReopen` booleano opcional), `updateOrderItemSchema` ("`quantity` y/o `notes` (al menos uno)"), `voidOrderItemSchema` (`units` "entero ≥ 1", `reason` "texto 3–200" con `trim`), `idempotencyKeySchema` (UUID), todos `.strict()`. Respuestas según [contracts/rest-api.yaml](contracts/rest-api.yaml): `moneySchema`, `tableOverviewSchema`, `orderItemResponseSchema`, `orderDetailSchema`, `dispatchResponseSchema`, `voidResultSchema`
- [X] T008 [P] Agregar a `packages/shared/src/events.ts` `DISPATCH_SENT: 'orders:dispatch-sent'`, `ITEM_VOIDED: 'orders:item-voided'` y `TABLE_STATUS_CHANGED: 'orders:table-status-changed'` en `REALTIME_EVENTS`, las interfaces `DispatchSentPayload`, `ItemVoidedPayload` y `TableStatusChangedPayload` de [contracts/websocket-events.md](contracts/websocket-events.md) y sus entradas en `ServerToClientEvents`; si la 004 no lo agregó, añadir también `kitchen:item-status-changed` con la carga `ItemStatusChangedPayload` del contrato de la 004
- [X] T009 Agregar a `apps/api/src/menu/tables.service.ts` el método `transition(tx: Prisma.TransactionClient, tableId: string, from: TableStatus[], to: TableStatus): Promise<boolean>` con `tx.diningTable.updateMany({ where: { id: tableId, status: { in: from } }, data: { status: to } })`, que devuelve `count === 1` ([research.md §2](research.md))
- [X] T010 Si no existe, agregar a `apps/api/src/realtime/realtime.gateway.ts` el método genérico `emitToRoles<E extends keyof ServerToClientEvents>(roles: Role[], event: E, ...args: Parameters<ServerToClientEvents[E]>): void`, con la misma firma que plantea la 004 (cambio coordinado con la 001)
- [X] T011 [P] Crear `apps/api/src/orders/order-locks.ts`: `DISPATCH_LOCK_KEY = 3003`, `acquireDispatchLock(tx)` (`SELECT pg_advisory_xact_lock(3003)`) y `lockOpenOrder(tx, orderId)` (`SELECT … FROM orders WHERE id = $1 FOR UPDATE`; `404 NOT_FOUND` si no existe y `409 ORDER_NOT_OPEN` si `status <> 'OPEN'`), con resultados tipados ([research.md §4 y §6](research.md))
- [X] T012 [P] Crear `apps/api/src/orders/order-mapper.ts` (de filas de Prisma a `OrderDetail`, `OrderItem` y `TableOverview`; montos `{ amount, formatted: 'S/ 0.00' }`; `activeQuantity = quantity − voidedQuantity`; `subtotal = unitPrice × activeQuantity`; consumo = suma de ítems enviados no `VOIDED`; `canCancel` y `canRequestBill` según [data-model.md §3](data-model.md)) y `apps/api/src/orders/order-mapper.spec.ts` con las pruebas unitarias de esos cálculos
- [X] T013 [P] Actualizar `resetDb` en `apps/api/test/helpers/db.ts` para borrar primero `itemVoid`, `orderItem`, `kitchenDispatch` y `order`, y crear `apps/api/test/helpers/order-factories.ts` con fábricas que insertan con Prisma: mesa (`tableNumber`, `status`), categoría y plato (`price`, `isAvailable`), pedido abierto con mozo responsable (y su mesa `OCUPADA`), ítem `DRAFT`, envío con `sequence` y `round`, e ítem enviado con estado y `unitPrice`; y el ayudante `simulateCashierPayment(app, orderId)`, que hace lo que hará Caja (005): en una transacción, `TablesService.transition(tx, tableId, ['POR_COBRAR'], 'LIBRE')` y pedido `PAID` con `closedAt`; después, `RealtimeGateway.emitToRoles(['WAITER', 'CASHIER'], 'orders:table-status-changed', { …, status: 'LIBRE' })` ([research.md §16](research.md)). Crear también `apps/api/test/helpers/realtime.ts` con `connectAs(url, user)`, extraído del patrón de `realtime.acceptance.spec.ts`, y `nextEvent(socket, evento, ms)`
- [X] T014 [P] Agregar a `apps/web/src/lib/api-client.ts` un parámetro opcional `headers?: Record<string, string>` en `request`, `requestJson` y `requestVoid`, sin cambiar las llamadas existentes ([research.md §5](research.md))
- [X] T015 [P] Si no existe, crear `apps/web/src/lib/realtime-context.tsx` (`RealtimeProvider`, `useRealtimeEvent(evento, manejador)` y `useRealtimeStatus()` con el estado conectado o desconectado), hacer que `apps/web/src/features/auth/useRealtime.ts` publique ahí el socket que ya abre y envolver el `<Outlet />` de `apps/web/src/app/AppShell.tsx` con el proveedor (cambio coordinado con la 001 y la 004)
- [X] T016 [P] Crear `apps/web/tests/msw/orders-handlers.ts` con manejadores de `/api/orders/*`, `/api/order-items/*` y `/api/menu/tree`, y datos de ejemplo en `apps/web/tests/fixtures.ts` (mesas en los tres estados, pedido con ítems por enviar y enviados, carta con un plato no disponible)
- [X] T017 [P] Ampliar `apps/api/prisma/seed-e2e.ts` (depende de T004):
  - **antes** de borrar los usuarios `prueba.*`, borrar en este orden `itemVoid`, `orderItem`, `kitchenDispatch` y `order`, porque sus claves foráneas hacia `users` son `Restrict` y el borrado de usuarios fallaría;
  - dejar todas las mesas `LIBRE` con un `updateMany`, porque el `upsert` actual de mesas usa `update: {}` y no reinicia el estado;
  - crear el usuario `mozo2`.

**Checkpoint**: base lista; las historias pueden empezar.

---

## Phase 3: User Story 1 - Ver las mesas y abrir una mesa libre (Priority: P1) 🎯 MVP

**Goal**: el mozo ve todas las mesas con su estado y responsable, abre una mesa libre (con
comensales opcionales) y puede cancelar una apertura por error.

**Independent Test**: dos mozos con sesión: uno abre una mesa y ambos la ven ocupada; el otro
no puede abrirla ni cancelarla; el responsable cancela y vuelve a libre.

### Tests for User Story 1 ⚠️

- [X] T018 [P] [US1] Escribir en `apps/api/test/acceptance/orders-tables.acceptance.spec.ts`:
  - `[003] AC-1.1`: `GET /api/orders/tables` lista todas las mesas por número con `status` y, en las no libres, `order.waiter.fullName`.
  - `[003] AC-1.2`: `POST /api/orders` responde 201; la mesa queda `OCUPADA` y el pedido `OPEN` con `waiter` = usuario y `openedAt`.
  - `[003] AC-1.4`: abrir una mesa `OCUPADA` o `POR_COBRAR` responde 409 `TABLE_NOT_AVAILABLE` y no hay un segundo pedido.
  - `[003] AC-1.5` (SC-008): dos mozos abren la misma mesa con `Promise.all`; uno recibe 201 y el otro 409 `TABLE_NOT_AVAILABLE` con `details.openedBy.fullName` y el mensaje "La mesa ya la abrió …"; queda exactamente una orden `OPEN`.
  - `[003] AC-1.6`: el responsable cancela y recibe 204; pedido `CANCELLED` y mesa `LIBRE`. Con un envío, 409 `CANCEL_NOT_ALLOWED`.
  - `[003] AC-1.7`: abrir sin `guestCount` lo deja nulo; otro mozo lo cambia a 4 con `PATCH /api/orders/:id` y responde 200; `guestCount: 0` responde 400.
  - `[003] AC-1.8`: otro mozo cancela y recibe 403 `FORBIDDEN` con "Solo el mozo que abrió la mesa puede cancelar la apertura"; un ADMIN sí puede.
  - Caso sin ID: KITCHEN recibe 403 en `GET /api/orders/tables` y CASHIER, 200.
- [X] T019 [P] [US1] Escribir en `apps/api/test/acceptance/orders-realtime.acceptance.spec.ts`: `[003] AC-1.3` (al abrir una mesa, los sockets de otro mozo y de un cajero reciben `orders:table-status-changed` con `tableNumber`, `status: 'OCUPADA'` y `orderId` en menos de 3 s; un socket de cocina no lo recibe)
- [X] T020 [P] [US1] Escribir en `apps/web/src/features/orders/TablesBoardPage.test.tsx` (MSW):
  - `[003] AC-1.1`: tarjetas "Mesa N" con el texto "Libre", "Ocupada" o "Por cobrar" y el nombre del responsable.
  - `[003] AC-1.3`: un `orders:table-status-changed` simulado hace volver a pedir las mesas y la tarjeta pasa a "Ocupada".
  - `[003] AC-1.5`: un 409 `TABLE_NOT_AVAILABLE` muestra "La mesa ya la abrió Rosa Quispe" y se vuelven a pedir las mesas.
- [X] T021 [P] [US1] Escribir en `apps/web/e2e/waiter.spec.ts` (ambos proyectos de tablet), con `mozo` y `mozo2` en dos páginas:
  - `[003] AC-1.2`: abrir una mesa lleva a `/mozo/pedidos/:orderId`.
  - `[003] AC-1.3`: la otra página la ve "Ocupada" en menos de 3 s sin recargar.

### Implementation for User Story 1

- [X] T022 [US1] Crear `apps/api/src/orders/orders.service.ts` (depende de T005 a T012):
  - `listTables()`: mesas por número con su orden `OPEN`, el mozo y si hay borradores.
  - `open(dto, user)`: en una transacción, `transition(['LIBRE'], 'OCUPADA')` más crear la orden. Si `transition` devuelve falso o hay un `P2002` del índice parcial, `409 TABLE_NOT_AVAILABLE` con `details { status, openedBy }` y el mensaje "La mesa ya la abrió {nombre}".
  - `getDetail(orderId)` y `updateGuestCount(orderId, dto)`, con `lockOpenOrder`.
  - `cancel(orderId, user)`: responsable o ADMIN, si no `403 FORBIDDEN` con mensaje propio; sin envíos, si no `409 CANCEL_NOT_ALLOWED`; pedido `CANCELLED` con `closedAt`; `transition(['OCUPADA'], 'LIBRE')`, si no `409 TABLE_STATE_CONFLICT` con `details.current`.
  - Después de cada commit que cambie la mesa, `emitToRoles(['WAITER', 'CASHIER'], 'orders:table-status-changed', …)`.
- [X] T023 [US1] Crear `apps/api/src/orders/orders.controller.ts` y registrarlo en `orders.module.ts`, con un pipe de UUID como el de `menu.controller.ts` (depende de T022):
  - `GET orders/tables`, declarado **antes** que `orders/:orderId`, con `@Roles('WAITER', 'CASHIER')`.
  - `POST orders`, 201, con `@Roles('WAITER')`.
  - `GET orders/:orderId` con `@Roles('WAITER', 'CASHIER')`.
  - `PATCH orders/:orderId`.
  - `POST orders/:orderId/cancel`, 204.
  - Cuerpos con `ZodValidationPipe`.
- [X] T024 [P] [US1] Crear `apps/web/src/features/orders/api.ts` con las claves `['orders', 'tables']` y `['orders', orderId]` y los hooks `useTablesBoard`, `useOrder` (con `refetchOnWindowFocus` y `refetchInterval: 15_000`, [research.md §10](research.md)), `useOpenTable`, `useUpdateGuests` y `useCancelOpening`, validando las respuestas con los esquemas de T007
- [X] T025 [P] [US1] Crear `apps/web/src/features/orders/useOrdersRealtime.ts`: con `useRealtimeEvent` escucha `orders:dispatch-sent`, `orders:item-voided`, `orders:table-status-changed` y `kitchen:item-status-changed`, y la reconexión del socket; ante cualquiera invalida `['orders']` (sin aplicar parches, [research.md §11](research.md))
- [X] T026 [US1] Crear `apps/web/src/features/orders/TableCard.tsx` (número, estado con texto y color AA, responsable y comensales; `touch-target`), `OpenTableDialog.tsx` (confirmación "¿Abrir la mesa N?" con comensales opcionales, de 1 a 50, con botones +/−) y `TablesBoardPage.tsx` (rejilla sin desplazamiento horizontal en 768 y 1366 px; tocar una mesa libre abre el diálogo y, al abrir, navega al pedido; tocar una ocupada o por cobrar navega a su pedido; usa `useOrdersRealtime`). `TablesBoardPage` mantiene el título `<h1>Mozo</h1>` que exige la prueba `[001] AC-2.5` (`apps/web/e2e/role-access.spec.ts`) (depende de T024, T025)
- [X] T027 [US1] Crear `apps/web/src/features/orders/OrderPage.tsx` con el encabezado:
  - "Mesa N", estado, responsable y comensales editables.
  - "Cancelar apertura", visible si `canCancel`, con `ConfirmDialog` de `features/users/` y el texto "¿Cancelar la apertura de la mesa N? Se descartará lo anotado."; al cancelar, vuelve a `/mozo`.
  - Registrar en `apps/web/src/app/router.tsx` `/mozo` → `TablesBoardPage` y `/mozo/pedidos/:orderId` → `OrderPage`, y borrar `apps/web/src/features/role-home/WaiterHome.tsx` (depende de T026).

**Checkpoint**: tablero de mesas en tiempo real con apertura segura; MVP demostrable.

---

## Phase 4: User Story 2 - Tomar el pedido de una mesa (Priority: P1)

**Goal**: el mozo arma el pedido con la carta disponible, cantidad y nota por ítem, y lo
corrige sin pedir permiso antes de enviarlo.

**Independent Test**: se abre una mesa y se arma un pedido por enviar con notas, cambios y un
ítem quitado; el pedido queda correcto aunque la cocina no esté conectada.

### Tests for User Story 2 ⚠️

- [ ] T028 [P] [US2] Escribir en `apps/api/test/acceptance/order-items.acceptance.spec.ts`:
  - `[003] AC-2.1`: un mozo pide `GET /api/menu/tree?availableOnly=true` y recibe solo platos disponibles y activos con `priceFormatted` "S/ …".
  - `[003] AC-2.2`: agregar un plato no disponible responde 409 `MENU_ITEM_UNAVAILABLE` y el plato no sale en la carta disponible.
  - `[003] AC-2.3`: `POST /api/orders/:id/items` con `quantity: 2` y `notes: "sin ají"` responde 201 con un ítem `DRAFT`, `unitPrice: null` y `currentPrice`.
  - `[003] AC-2.4`: el mismo plato con otra nota crea un segundo ítem.
  - `[003] AC-2.5`: cualquier mozo cambia cantidad o nota de un borrador con `PATCH /api/order-items/:id` y recibe 200; `quantity: 0` responde 400 y una nota de 141 caracteres también.
  - `[003] AC-2.6`: `DELETE /api/order-items/:id` responde 204, el ítem ya no está en `GET /api/orders/:id`, no hay envíos y un socket de cocina no recibe ningún evento en 1 s.
  - `[003] AC-2.7`: los borradores siguen iguales en `GET /api/orders/:id` después de operar en otra mesa.
- [ ] T029 [P] [US2] Escribir en `apps/web/src/features/orders/OrderPage.test.tsx` (MSW):
  - `[003] AC-2.1`: la carta muestra solo los platos disponibles, por categoría, con "S/ 24.50".
  - `[003] AC-2.6`: "Quitar" abre la confirmación y la API solo se llama al confirmar.

### Implementation for User Story 2

- [X] T030 [US2] Crear `apps/api/src/orders/order-items.service.ts`; todas las operaciones usan `lockOpenOrder` (depende de T011, T012):
  - `add(orderId, dto)`: el plato debe tener `isAvailable` e `isActive`, si no `409 MENU_ITEM_UNAVAILABLE`; crea el ítem `DRAFT` con `notes` recortada. Con la mesa `POR_COBRAR` responde por ahora `409 TABLE_AWAITING_PAYMENT`; la reapertura llega en US6.
  - `update(itemId, dto)` y `remove(itemId)`: solo `DRAFT`, si no `409 ITEM_ALREADY_SENT`; `remove` borra la fila y no emite eventos.
- [X] T031 [US2] Agregar `POST orders/:orderId/items` (201, `@Roles('WAITER')`) a `orders.controller.ts` y crear `apps/api/src/orders/order-items.controller.ts` con `PATCH order-items/:itemId` y `DELETE order-items/:itemId` (204), y registrarlo en el módulo (depende de T030)
- [X] T032 [P] [US2] Agregar a `apps/web/src/features/orders/api.ts` `useMenuForOrder` (`GET /api/menu/tree?availableOnly=true`), `useAddItem`, `useUpdateItem` y `useRemoveItem`
- [X] T033 [US2] Crear `apps/web/src/features/orders/MenuPicker.tsx` (categorías, plato con precio, cantidad con +/− de 44 px, nota opcional con contador de 140 caracteres, "Agregar") y `DraftItems.tsx` (sección "Por enviar": cantidad editable, editar nota, "Quitar" con `ConfirmDialog`, marca "No disponible" si `isAvailable` es falso), e integrarlos en `OrderPage.tsx`, apilados en vertical y lado a lado en 1366 px (depende de T032)

**Checkpoint**: el pedido se toma sin papel; todavía no sale a cocina.

---

## Phase 5: User Story 3 - Enviar el pedido a cocina por rondas (Priority: P1)

**Goal**: el mozo envía en una acción todo lo no enviado; la cocina recibe cada ronda una sola
vez, en orden, aunque se corte la conexión.

**Independent Test**: dos rondas de una mesa y una de otra; cada envío trae solo lo nuevo, en
orden de confirmación, y un reintento con la misma clave no duplica.

### Tests for User Story 3 ⚠️

- [ ] T034 [P] [US3] Escribir en `apps/api/test/acceptance/dispatches.acceptance.spec.ts`:
  - `[003] AC-3.1`: `POST /api/orders/:id/dispatches` con `Idempotency-Key` responde 201 con `sequence`, `round: 1`, `sentBy`, `sentAt` y los ítems con cantidad y nota; los ítems quedan `PENDING` con `unitPrice` = precio de la carta. FR-025: si después cambia el precio de la carta, el `unitPrice` no cambia.
  - `[003] AC-3.3`: la segunda ronda (`round: 2`) lleva solo los dos ítems nuevos.
  - `[003] AC-3.4`: sin borradores, 409 `NOTHING_TO_SEND` y ningún envío nuevo.
  - `[003] AC-3.5`: un plato marcado no disponible después de agregarlo da 409 `ITEMS_UNAVAILABLE`, con `details.items` que lo nombra; nada cambia y, al quitarlo, el envío sale.
  - `[003] AC-3.6` (SC-002): 10 envíos simultáneos de mesas distintas con `Promise.all` dan `sequence` 1 a 10 sin huecos ni repetidos, y el orden de `sequence` coincide con el de `sentAt`.
  - `[003] AC-3.7`: `PATCH` y `DELETE` de un ítem `PENDING` responden 409 `ITEM_ALREADY_SENT`.
  - `[003] AC-3.9` (SC-001): la misma clave dos veces seguidas, y también simultáneas, devuelve el mismo `id` y deja una sola fila; la clave usada en otro pedido da 409 `IDEMPOTENCY_KEY_REUSED`.
  - `[003] AC-3.10`: el mozo B envía en la mesa del mozo A; `sentBy` es B y `order.waiter` sigue siendo A.
  - Caso sin ID: sin la cabecera, o con un valor que no es UUID, responde 400.
- [ ] T035 [P] [US3] Agregar a `orders-realtime.acceptance.spec.ts`: `[003] AC-3.2` (un socket de cocina recibe `orders:dispatch-sent` con `dispatchId`, `sequence`, `round`, `tableNumber` e `itemCount` en menos de 3 s, SC-003; el reintento con la misma clave no emite otra vez)
- [ ] T036 [P] [US3] Agregar a `OrderPage.test.tsx`:
  - `[003] AC-3.1`: tras enviar se ve "Ronda 1 enviada a cocina" y los ítems pasan a la sección enviada como "Pendiente".
  - `[003] AC-3.4`: el botón está deshabilitado sin borradores y, ante un 409 `NOTHING_TO_SEND`, se ve "No hay nada nuevo que enviar".
  - `[003] AC-3.5`: un 409 `ITEMS_UNAVAILABLE` marca esos ítems "No disponible" y muestra el mensaje.
  - `[003] AC-3.8`: un error de red muestra "No se pudo enviar: no hay conexión. Tus ítems siguen por enviar.", los ítems siguen por enviar y "Reintentar" manda la **misma** `Idempotency-Key`, capturada por MSW.
- [ ] T037 [P] [US3] Agregar a `apps/web/e2e/waiter.spec.ts`:
  - `[003] AC-3.1`: enviar desde la tablet muestra la confirmación.
  - `[003] AC-3.8`: con `context.setOffline(true)` el envío falla, aparece el banner "Sin conexión" y los ítems siguen por enviar.
  - `[003] AC-3.9`: con `page.route` que deja pasar la petición y aborta la respuesta (`route.fetch()` y luego `route.abort()`), "Reintentar" deja un solo envío en `GET /api/orders/:id`.

### Implementation for User Story 3

- [X] T038 [P] [US3] Crear `apps/api/src/orders/idempotency-key.decorator.ts`: decorador de parámetro que lee `Idempotency-Key` y la valida con `idempotencyKeySchema`; si falta o no es válida, `400 VALIDATION_ERROR` con `details { 'Idempotency-Key': 'Falta la clave de envío' }`
- [X] T039 [US3] Crear `apps/api/src/orders/dispatches.service.ts` con `send(orderId, key, user)` en una transacción ([research.md §4 a §6, §8](research.md)) (depende de T011, T012, T030):
  1. `acquireDispatchLock`.
  2. Buscar la clave: en el mismo pedido devuelve ese envío sin emitir; en otro pedido, `409 IDEMPOTENCY_KEY_REUSED`.
  3. `lockOpenOrder`.
  4. Borradores con `FOR UPDATE`; sin borradores, `409 NOTHING_TO_SEND`.
  5. Disponibilidad (`isAvailable` e `isActive`); si falla alguno, `409 ITEMS_UNAVAILABLE` con `details.items [{ orderItemId, menuItemId, name }]`.
  6. `sequence = COALESCE(MAX(sequence), 0) + 1` y `round = COUNT + 1`.
  7. Crear el `KitchenDispatch`.
  8. Una sola sentencia SQL pasa los borradores a `PENDING` con `dispatch_id` y `unit_price = menu_items.price`.
  - Un `P2002` sobre la clave se resuelve releyendo el envío. Después del commit, y solo si se creó, `emitToRoles(['KITCHEN', 'WAITER'], 'orders:dispatch-sent', …)`.
- [X] T040 [US3] Crear `apps/api/src/orders/dispatches.controller.ts` con `POST orders/:orderId/dispatches` (201, `@Roles('WAITER')`, `@IdempotencyKey()`) y registrarlo en el módulo (depende de T038, T039)
- [X] T041 [P] [US3] Crear `apps/web/src/features/orders/pending-dispatch.ts`: `getOrCreateKey(orderId)` y `clearKey(orderId)` sobre `sessionStorage` con `try/catch` (con respaldo en memoria si falla), y la clave UUID v4 generada con `crypto.getRandomValues` (no `crypto.randomUUID`, que no existe en `http://` de la red local)
- [X] T042 [US3] Agregar a `apps/web/src/features/orders/api.ts` `useSendToKitchen(orderId)` (depende de T014, T041):
  - envía con la cabecera `Idempotency-Key` de `getOrCreateKey`;
  - `clearKey` ante 201 o un 409 definitivo (`NOTHING_TO_SEND`, `ITEMS_UNAVAILABLE`, `ORDER_NOT_OPEN`, `IDEMPOTENCY_KEY_REUSED`);
  - conserva la clave ante `NETWORK_ERROR` o 5xx;
  - siempre invalida `['orders']`.
- [X] T043 [US3] Si no existe, crear `apps/web/src/components/ConnectionBanner.tsx` con `useRealtimeStatus` y `navigator.onLine`, que muestre "Sin conexión. Lo enviado está a salvo; para enviar a cocina necesitas conexión."; montarlo en `TablesBoardPage.tsx` y `OrderPage.tsx` y agregar a `OrderPage.tsx` el botón "Enviar a cocina" (deshabilitado sin borradores), que pasa a "Reintentar" tras un error de red, más los mensajes de [contracts/ui-routes.md](contracts/ui-routes.md) (depende de T042)

**Checkpoint**: US1 a US3 forman el producto mínimo: de la mesa a la cocina sin papel.

---

## Phase 6: User Story 4 - Seguir lo enviado y recibir avisos de platos listos (Priority: P2)

**Goal**: el mozo ve el estado de cada ítem enviado sin recargar. Los avisos de plato listo
son de la 004 (bandeja `ReadyNoticesTray`).

**Independent Test**: se cambian los estados de los ítems (cocina o un sustituto) y el mozo
ve cada cambio sin recargar. Los avisos los prueba la 004 (AC-3.1, AC-3.3 y AC-3.5).

### Tests for User Story 4 ⚠️

- [ ] T044 [P] [US4] Agregar a `OrderPage.test.tsx`:
  - `[003] AC-4.1`: los ítems enviados se agrupan por ronda ("Ronda 1 · 12:40", hora `es-PE`), con el texto "Pendiente", "En preparación", "Listo" o "Anulado", separados de "Por enviar".
  - `[003] AC-4.2`: un `kitchen:item-status-changed` simulado hace volver a pedir el pedido y el ítem pasa a "En preparación".
- [ ] T045 [US4] Pedir al dueño de la 004 que su prueba de AC-3.1 en `apps/web/e2e/kitchen.spec.ts` muestre el aviso también en una pantalla distinta de `/mozo` (por ejemplo `/mozo/pedidos/:orderId`), para cubrir el "en cualquier pantalla" de FR-027 ([research.md §17](research.md), P8)

### Implementation for User Story 4

- [X] T046 [US4] Crear `apps/web/src/features/orders/SentItems.tsx` (agrupado por ronda; etiqueta de estado con texto y color AA; unidades anuladas con su motivo) e integrarlo en `OrderPage.tsx`; comprobar que `useOrdersRealtime` (T025) escucha `kitchen:item-status-changed` con la constante de `events.ts` (depende de T025, T043)

**Checkpoint**: el mozo sigue sus platos sin ir a preguntar; los avisos llegan con la 004.

---

## Phase 7: User Story 5 - Anular un ítem ya enviado con autorización (Priority: P2)

**Goal**: el administrador anula todas o algunas unidades de un ítem pendiente o en
preparación, con motivo; cocina se entera al instante y lo anulado no se cobra.

**Independent Test**: un ADMIN anula 1 de 3 unidades y luego el resto; la cocina recibe el
evento, el mozo ve el ítem anulado y el consumo baja.

### Tests for User Story 5 ⚠️

- [ ] T047 [P] [US5] Escribir en `apps/api/test/acceptance/voids.acceptance.spec.ts`:
  - `[003] AC-5.1`: un ADMIN anula un ítem `PENDING` (y otro `PREPARING`) completo con motivo; responde 201, el ítem queda `VOIDED` y se crea un `ItemVoid` con `voidedById`, `voidedAt` y `reason`.
  - `[003] AC-5.3`: sin `reason`, o con un motivo de 2 caracteres, responde 400 y nada cambia.
  - `[003] AC-5.4`: un ítem `READY` responde 409 `ITEM_NOT_VOIDABLE` con `details.reason: 'READY'` y el mensaje "El plato ya está listo; no se puede anular". Además: `VOIDED` da `reason: 'VOIDED'`, `DRAFT` da `'NOT_SENT'` y pedir más unidades de las que quedan da `'NOT_ENOUGH_UNITS'` con `remainingQuantity`.
  - `[003] AC-5.5`: WAITER, KITCHEN y CASHIER reciben 403.
  - `[003] AC-5.6`: en `GET /api/orders/:id` el ítem aparece `VOIDED` y no suma al consumo.
  - `[003] AC-5.7`: anular 1 de 3 deja `voidedQuantity: 1`, el estado sin cambiar, `activeQuantity: 2` y un consumo de 2 × precio; anular las otras 2 lo deja `VOIDED`.
  - Caso sin ID: una anulación y un cambio a `READY` simultáneos (con `UPDATE … WHERE status = 'PREPARING'` en la prueba) terminan en un estado coherente: o anulado o listo, nunca las dos cosas.
- [ ] T048 [P] [US5] Agregar a `orders-realtime.acceptance.spec.ts`: `[003] AC-5.2` (un socket de cocina recibe `orders:item-voided` con `units`, `remainingQuantity`, `tableNumber` y `dispatchId` en menos de 3 s)
- [ ] T049 [P] [US5] Agregar a `OrderPage.test.tsx`: `[003] AC-5.3` ("Anular" solo aparece para ADMIN en ítems pendientes o en preparación; el diálogo propone todas las unidades restantes y "Anular" queda deshabilitado hasta tener un motivo de al menos 3 caracteres)

### Implementation for User Story 5

- [ ] T050 [US5] Crear `apps/api/src/orders/voids.service.ts` con `void(itemId, dto, admin)` en una transacción ([research.md §7](research.md)) (depende de T011, T012):
  - El pedido debe estar `OPEN`, si no `409 ORDER_NOT_OPEN`.
  - Con `$queryRaw`: `UPDATE order_items SET voided_quantity = voided_quantity + $units, status = CASE WHEN voided_quantity + $units = quantity THEN 'VOIDED' ELSE status END WHERE id = $id AND status IN ('PENDING','PREPARING') AND quantity - voided_quantity >= $units RETURNING …`.
  - Insertar el `ItemVoid`.
  - Si no se actualizó nada, releer el ítem y responder `409 ITEM_NOT_VOIDABLE` con `details { reason, remainingQuantity }`; el mensaje para `READY` es "El plato ya está listo; no se puede anular".
  - Después del commit, `emitToRoles(['KITCHEN', 'WAITER'], 'orders:item-voided', …)`.
- [ ] T051 [US5] Agregar a `order-items.controller.ts` `POST order-items/:itemId/voids` (201, `@Roles('ADMIN')`, `ZodValidationPipe(voidOrderItemSchema)`) (depende de T050)
- [ ] T052 [US5] Agregar `useVoidItem` a `apps/web/src/features/orders/api.ts` y crear `apps/web/src/features/orders/VoidItemDialog.tsx` (unidades con +/−, de 1 a las que quedan, todas por defecto; motivo obligatorio de 3 a 200 caracteres; confirmación); mostrar "Anular" en `SentItems.tsx` solo si el usuario es ADMIN y el ítem está `PENDING` o `PREPARING` con unidades vigentes (depende de T046)

**Checkpoint**: las correcciones quedan en el sistema, con motivo y responsable.

---

## Phase 8: User Story 6 - Pedir la cuenta (Priority: P3)

**Goal**: el mozo pide la cuenta y la mesa pasa a por cobrar para todos y para Caja; si piden
algo más, la mesa vuelve a ocupada con confirmación.

**Independent Test**: se pide la cuenta de una mesa con consumo; la mesa queda por cobrar
para mozos y caja, ningún mozo puede liberarla y, al agregar algo, vuelve a ocupada.

### Tests for User Story 6 ⚠️

- [ ] T053 [P] [US6] Agregar a `orders-tables.acceptance.spec.ts`:
  - `[003] AC-6.1`: `POST /api/orders/:id/request-bill` responde 200 y la mesa queda `POR_COBRAR`.
  - `[003] AC-6.3`: con borradores, 409 `HAS_UNSENT_ITEMS`.
  - `[003] AC-6.4`: sin envíos, 409 `NO_CONSUMPTION`; con todo anulado, también.
  - `[003] AC-6.6` (datos): tras `simulateCashierPayment`, `GET /api/orders/tables` muestra la mesa `LIBRE` con `order: null` y se puede abrir de nuevo.
  - Caso sin ID: pedir la cuenta dos veces da 409 `TABLE_STATE_CONFLICT`.
- [ ] T054 [P] [US6] Agregar a `order-items.acceptance.spec.ts`:
  - `[003] AC-6.2`: `GET /api/orders/:id` trae `consumption.total` y, por ítem enviado, `activeQuantity`, `unitPrice` y `subtotal` con formato "S/ …", con la mesa `OCUPADA` y con la mesa `POR_COBRAR`.
  - `[003] AC-6.7`: agregar con la mesa `POR_COBRAR` sin `confirmReopen` da 409 `TABLE_AWAITING_PAYMENT`; con `confirmReopen: true` da 201, la mesa queda `OCUPADA` y hay que pedir la cuenta otra vez.
- [ ] T055 [P] [US6] Agregar a `orders-realtime.acceptance.spec.ts`:
  - `[003] AC-6.1`: los sockets de mozo y de cajero reciben `orders:table-status-changed` con `status: 'POR_COBRAR'` (SC-004).
  - `[003] AC-6.6` (tiempo real): tras `simulateCashierPayment`, el socket de un mozo recibe `orders:table-status-changed` con `status: 'LIBRE'` en menos de 3 s. Esta prueba fija lo que la 005 debe hacer al cobrar.
- [ ] T056 [P] [US6] Agregar a `TablesBoardPage.test.tsx` `[003] AC-6.5` (una mesa "Por cobrar" no ofrece ninguna acción para liberarla) y a `OrderPage.test.tsx`:
  - `[003] AC-6.2`: el resumen de consumo muestra cantidades, precio, subtotales y el total en soles.
  - `[003] AC-6.3`: un 409 `HAS_UNSENT_ITEMS` muestra "Hay ítems sin enviar. Envíalos o quítalos antes de pedir la cuenta."
  - `[003] AC-6.7`: agregar con la mesa por cobrar muestra "La mesa está por cobrar. ¿Volver a abrirla para agregar?" y, al confirmar, repite la petición con `confirmReopen: true`.

### Implementation for User Story 6

- [ ] T057 [US6] Agregar a `orders.service.ts` `requestBill(orderId)` con `lockOpenOrder` (depende de T022):
  - con borradores, `409 HAS_UNSENT_ITEMS`;
  - sin unidades vigentes enviadas, `409 NO_CONSUMPTION`;
  - `transition(['OCUPADA'], 'POR_COBRAR')`, si no `409 TABLE_STATE_CONFLICT` con `details.current`;
  - después del commit emite `orders:table-status-changed`.
- [ ] T058 [US6] Extender `add` en `order-items.service.ts`: con la mesa `POR_COBRAR`, si no llega `confirmReopen: true` sigue respondiendo `409 TABLE_AWAITING_PAYMENT`; si llega, en la misma transacción hace `transition(['POR_COBRAR'], 'OCUPADA')` y crea el ítem, y después del commit emite `orders:table-status-changed` (depende de T030)
- [ ] T059 [US6] Agregar a `orders.controller.ts` `POST orders/:orderId/request-bill` (200, `@Roles('WAITER')`) (depende de T057)
- [ ] T060 [US6] Agregar `useRequestBill` a `apps/web/src/features/orders/api.ts`. En `OrderPage.tsx` (depende de T033, T046):
  - crear `apps/web/src/features/orders/ConsumptionSummary.tsx`;
  - "Pedir la cuenta", visible si `canRequestBill`, con la confirmación "¿Pedir la cuenta de la mesa N?";
  - en `useAddItem`, el diálogo de reapertura ante `TABLE_AWAITING_PAYMENT`.

**Checkpoint**: el mozo atiende la mesa de principio a fin sin papel.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: tablet, rendimiento, puertas de calidad y validación final.

- [ ] T061 [P] Ampliar `apps/web/e2e/tablet.spec.ts` con `/mozo` y `/mozo/pedidos/:orderId` (usando un pedido creado en el `beforeAll`): sin desplazamiento horizontal en 768×1024 y 1366×1024 y controles de al menos 44×44 px (Principio IV)
- [ ] T062 [P] Agregar a `dispatches.acceptance.spec.ts` una prueba de rendimiento sin ID: con 15 mesas y 60 envíos, `GET /api/orders/tables` y `GET /api/orders/:id` responden en menos de 200 ms y un envío en menos de 500 ms (p95 de 20 llamadas) ([plan.md](plan.md), Technical Context)
- [ ] T063 Ejecutar `npm run typecheck`, `npm run lint`, `npm run test --workspace apps/api`, `npm run test --workspace apps/web` y `npm run test:e2e`, y corregir hasta que todo pase
- [ ] T064 Ejecutar `npm run check:ac -- 003` (debe dar 41/41) y agregar `003` al paso de cobertura de `.github/workflows/ci.yml` (`npm run check:ac -- 001 002 003`) en este mismo PR
- [ ] T065 Hacer el recorrido manual de [quickstart.md](quickstart.md) en tablet (pasos 1 a 15, incluido el cronometraje de SC-006) y anotar los resultados en el PR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → historias.
- **US1 (P1)**: depende solo de Foundational. Es el MVP.
- **US2 (P1)**: depende de US1 (necesita una mesa abierta y `OrderPage`); sus pruebas de API usan fábricas.
- **US3 (P1)**: depende de US2 (envía los borradores).
- **US4 (P2)**: depende de US3 (necesita ítems enviados).
- **US5 (P2)**: depende de US3 y de `SentItems.tsx` (T046) en la parte web; la API solo depende de US3.
- **US6 (P3)**: depende de US3 (consumo) y de US2 (agregar con reapertura).
- **Polish (Phase 9)**: al final.

### Within Each User Story

- Pruebas primero; deben fallar antes de implementar.
- Servicio → controlador → hooks del cliente → componentes.
- Los eventos se emiten siempre después del commit.

### Parallel Opportunities

- Setup: T002 y T003.
- Foundational: T006, T007, T008, T011 a T017 en paralelo (archivos distintos); T005 después de T004; T009 y T010 son cambios pequeños en archivos de otras features.
- En cada historia, todas las tareas de prueba [P] en paralelo.
- Con dos personas: US4 (web) en paralelo con US5 (API, T047, T048, T050, T051) después de US3.

## Parallel Example: User Story 3

```bash
Task: "T034 [003] AC-3.1/3.3/3.4/3.5/3.6/3.7/3.9/3.10 en dispatches.acceptance.spec.ts"
Task: "T035 [003] AC-3.2 en orders-realtime.acceptance.spec.ts"
Task: "T036 [003] AC-3.1/3.4/3.5/3.8 en OrderPage.test.tsx"
Task: "T037 [003] AC-3.1/3.8/3.9 en e2e/waiter.spec.ts"
Task: "T038 idempotency-key.decorator.ts"
Task: "T041 pending-dispatch.ts"
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phases 1 y 2.
2. Phase 3 (US1) → validar los pasos 1 a 3 y 14 de [quickstart.md](quickstart.md).
3. Demostrable: tablero de mesas en tiempo real con apertura segura.

### Incremental Delivery

1. US1 → US2 → US3: de la mesa a la cocina sin papel (pasos 4 a 9 del quickstart).
2. US4: seguimiento de estados (avisos con la 004).
3. US5: anulaciones con motivo.
4. US6: pedir la cuenta y reabrir.
5. Polish y un único PR revisado por Paolo.

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- Las etiquetas [US1]…[US6] corresponden a las historias de [spec.md](spec.md).
- Cada criterio `AC-x.y` aparece al menos una vez como `[003] AC-x.y` en las tareas de prueba.
- No se borran ítems enviados ni pedidos: solo los borradores quitados.
- Los desajustes P1 a P8 de [research.md §17](research.md) los resuelven otros dueños; no son
  tareas de esta feature, salvo el pedido a la 004 de T045.
- Cuando la 005 exista, su prueba de cobro reemplaza a `simulateCashierPayment` en AC-6.6.
