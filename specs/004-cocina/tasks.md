---

description: "Lista de tareas de la feature 004-cocina"
---

# Tasks: Módulo Cocina — pantalla de comandas

**Input**: Design documents from `/specs/004-cocina/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: OBLIGATORIAS (Principio II). Cada prueba de aceptación lleva en su título el
prefijo de la feature y el ID del criterio: `"[004] AC-2.1: …"`. Las pruebas de cada historia
se escriben primero y deben fallar antes de implementar.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Rama**: todo el trabajo va en la rama `004-cocina` y se integra con un único PR al terminar,
revisado por el responsable de la 003.

**Requisito previo**: la 001 y la migración de la 003 (mesas, pedidos, envíos, ítems y
anulaciones) deben estar en `main`, y los acuerdos de
[contracts/dependencias-003.md](contracts/dependencias-003.md) confirmados.

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

- [X] T001 Actualizar la rama `004-cocina` con `main` y confirmar que existen los modelos de la 003 (`KitchenDispatch`, `Order`, `DiningTable`, `OrderItem` con `voidedQuantity`, `ItemVoid`) en `apps/api/prisma/schema.prisma`; si algún nombre difiere de [data-model.md §4](data-model.md), ajustar ese documento antes de seguir
- [X] T002 [P] Crear `apps/api/src/kitchen/kitchen.module.ts` (vacío, importa `PrismaModule` y `RealtimeModule`) y registrarlo en `apps/api/src/app.module.ts`
- [X] T003 [P] Agregar `004` al paso de cobertura en `.github/workflows/ci.yml` (`npm run check:ac -- 001 004`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: datos, contratos compartidos y canal de tiempo real que usan todas las historias.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

- [X] T004 Agregar a `apps/api/prisma/schema.prisma` los modelos `OrderItemStatusChange`, `ReadyNotice` y `KitchenVoidAck` según [data-model.md §1](data-model.md) (UUID, `Timestamptz(3)`, `@@map` en snake_case, `onDelete: Restrict`) y generar la migración `apps/api/prisma/migrations/<fecha>_kitchen/migration.sql`, añadiendo a mano el índice único parcial `ready_notices_open_item`
- [X] T005 [P] Agregar a `packages/shared/src/errors.ts` los códigos `ITEM_STATE_CONFLICT` ("Otro usuario ya cambió este plato. Revisa su estado actual."), `ITEM_VOIDED` ("Este plato fue anulado"), `READY_ALREADY_SEEN` ("El mozo ya recogió este plato") y `UNDO_NOT_ALLOWED` ("Ya no se puede deshacer este cambio")
- [X] T006 [P] Crear `packages/shared/src/schemas/kitchen.ts` con los esquemas Zod `AdvanceItemBody`, `UndoItemBody`, `TicketItem`, `Ticket`, `VoidNotice`, `KitchenBoard` y `ReadyNotice` de [contracts/rest-api.yaml](contracts/rest-api.yaml), y exportarlos en `packages/shared/src/index.ts`
- [X] T007 [P] Agregar a `packages/shared/src/events.ts` los eventos `kitchen:item-status-changed`, `kitchen:ready-notice`, `kitchen:ready-notice-closed` y `kitchen:void-acknowledged` con sus cargas tipadas, y los eventos de la 003 que escucha cocina, en `REALTIME_EVENTS` y `ServerToClientEvents` ([contracts/websocket-events.md](contracts/websocket-events.md))
- [X] T008 Agregar a `apps/api/src/realtime/realtime.gateway.ts` los métodos genéricos `emitToRoles(roles, event, payload)` y `emitToUser(userId, event, payload)`, tipados con `ServerToClientEvents` (cambio coordinado con la 001)
- [X] T009 [P] Crear `apps/web/src/lib/realtime-context.tsx` (`RealtimeProvider` y `useRealtimeEvent(evento, manejador)`), hacer que `apps/web/src/features/auth/useRealtime.ts` publique en ese contexto el socket que ya abre, y envolver el `<Outlet />` de `apps/web/src/app/AppShell.tsx` con el proveedor (cambio coordinado con la 001)
- [X] T010 [P] Crear `apps/api/test/helpers/kitchen-factories.ts` con fábricas que insertan con Prisma: mesa, pedido con mozo responsable, envío con `sequence` y `round`, ítems (plato o bebida, cantidad, nota, estado) y anulaciones con unidades; reutilizar las fábricas de usuarios de la 001

**Checkpoint**: base lista; las historias pueden empezar.

---

## Phase 3: User Story 1 - Ver las comandas en orden de llegada (Priority: P1) 🎯 MVP

**Goal**: la cocina ve todas las comandas activas, en orden de envío, sin recargar.

**Independent Test**: se crean envíos de varias mesas y se comprueba orden, contenido y que no
hay duplicados en `GET /api/kitchen/board` y en la pantalla.

### Tests for User Story 1 ⚠️

- [X] T011 [P] [US1] Escribir en `apps/api/test/acceptance/kitchen-board.acceptance.spec.ts`: `[004] AC-1.2` (envíos N.º 12 y 13 salen en ese orden aunque se inserten al revés); `[004] AC-1.4` (cada comanda trae `sequence`, `tableNumber`, `sentBy.fullName`, `sentAt` y por ítem `quantity`, `name`, `notes`); `[004] AC-1.5` (segunda ronda de la mesa 3 con `round: 2` y su propio `sequence`); `[004] AC-1.6` (reintentar el envío con la misma clave de idempotencia por el endpoint de la 003 deja una sola comanda); `[004] AC-1.7` (un envío con adobo y chicha muestra ambos ítems). Caso sin ID: mozo y cajero reciben 403 en `GET /api/kitchen/board`
- [X] T012 [P] [US1] Escribir en `apps/web/src/features/kitchen/KitchenBoardPage.test.tsx` (MSW): `[004] AC-1.1` (tablero vacío muestra "No hay pedidos pendientes"); `[004] AC-1.3` (al llegar un evento de envío y volver a pedir el tablero, la comanda nueva aparece al final con la marca de nueva y se llama una vez a la función de sonido, que está simulada); `[004] AC-1.4` (se ven "Mesa 5", el mozo, la hora en formato `es-PE` y la nota "sin ají" resaltada). Casos sin ID: con "Silenciar" activo no suena (FR-003); al desconectarse el socket aparece "Sin conexión" y al reconectarse se vuelve a pedir el tablero (FR-025)
- [X] T013 [P] [US1] Escribir en `apps/web/e2e/kitchen.spec.ts` (ambos proyectos de tablet): `[004] AC-1.3` (con `/cocina` abierta, un envío creado por la API aparece en menos de 3 s sin recargar)

### Implementation for User Story 1

- [X] T014 [US1] Crear `apps/api/src/kitchen/kitchen-board.service.ts` con `getBoard(now)`: comandas con algún ítem `PENDING`/`PREPARING` ordenadas por `sequence`, cada ítem con `name` del plato, `toPrepare` y `statusChangedAt`, más `serverTime` (depende de T004, T006)
- [X] T015 [US1] Crear `apps/api/src/kitchen/kitchen.controller.ts` con `GET /kitchen/board` y `@Roles(Role.KITCHEN)`, respuesta validada con el esquema `KitchenBoard` (depende de T014)
- [X] T016 [P] [US1] Crear `apps/web/src/features/kitchen/api.ts` con `useKitchenBoard()` (TanStack Query) que vuelve a pedir el tablero ante los eventos de la 003 y al reconectarse el socket, usando `useRealtimeEvent` (depende de T009)
- [X] T017 [P] [US1] Crear `apps/web/src/features/kitchen/TicketCard.tsx` y `TicketItemRow.tsx`: número de envío, "Mesa N" o "Mesa N · k.ª ronda", mozo, hora, ítems con cantidad y nota resaltada; texto con la clase `text-kitchen` (≥ 18 px)
- [X] T018 [P] [US1] Crear `apps/web/src/features/kitchen/sound.ts` (tono corto con Web Audio API, estado "Silenciar" en `localStorage` con `try/catch`, botón "Activar sonido" si el contexto de audio está suspendido) y `useNewTicketAlert.ts` (compara los `dispatchId` con el tablero anterior, resalta los nuevos 10 s y suena una vez; no suena en la primera carga)
- [X] T019 [US1] Reutilizar `apps/web/src/components/ConnectionBanner.tsx` de la 003 con un mensaje propio ("Sin conexión — los pedidos nuevos no se están recibiendo") y crear `KitchenBoardPage.tsx` (rejilla de una columna en 768 px y de 2 o 3 en 1366 px, sin desplazamiento horizontal, mensaje vacío); registrar `/cocina → KitchenBoardPage` en `apps/web/src/app/router.tsx` y borrar `features/role-home/KitchenHome.tsx` (depende de T016–T018)

**Checkpoint**: la cocina recibe comandas en tiempo real; es el MVP demostrable.

---

## Phase 4: User Story 2 - Actualizar el estado de cada plato (Priority: P1)

**Goal**: un toque por paso, "Deshacer" con confirmación y comandas completas fuera de la lista.

**Independent Test**: se recorren los estados de una comanda y se verifica la secuencia, el
historial, la sección "Completadas" y que otra pantalla lo ve.

### Tests for User Story 2 ⚠️

- [X] T020 [P] [US2] Escribir en `apps/api/test/acceptance/kitchen-items.acceptance.spec.ts`: `[004] AC-2.1` y `[004] AC-2.2` (cada `advance` cambia el estado y deja una fila en `order_item_status_changes`); `[004] AC-2.3` (`advance` con `from: PENDING` sobre un ítem ya en `PREPARING` → 409 `ITEM_STATE_CONFLICT` con `details.current`; nunca se salta a `READY`); `[004] AC-2.5` (`undo` desde `PREPARING` vuelve a `PENDING` con `isUndo: true`); `[004] AC-2.7` (mozo y cajero reciben 403 `FORBIDDEN` con "No tienes permiso para realizar esta acción" y el estado no cambia). Caso sin ID: dos `advance` simultáneos con el mismo `from` → uno 200 y otro 409
- [X] T021 [P] [US2] Agregar a `apps/api/test/acceptance/kitchen-board.acceptance.spec.ts`: `[004] AC-2.4` (al quedar listo el último ítem no anulado, la comanda pasa a `completed` con `completedAt`; con el reloj 31 min después ya no aparece)
- [X] T022 [P] [US2] Escribir en `apps/api/test/acceptance/kitchen-realtime.acceptance.spec.ts` (socket.io-client): `[004] AC-2.6` (un socket de cocina y uno de mozo reciben `kitchen:item-status-changed` tras un `advance`)
- [X] T023 [P] [US2] Escribir `apps/api/src/kitchen/kitchen-rules.spec.ts` (unitarias de las reglas puras de `kitchen-rules.ts`): pasos permitidos, estado de la comanda, ventana de 30 min y cuándo se puede deshacer; el caso `UNDO_NOT_ALLOWED` va en `kitchen-items.acceptance.spec.ts`
- [X] T024 [P] [US2] Agregar a `KitchenBoardPage.test.tsx`: `[004] AC-2.5` ("Deshacer" abre la confirmación y solo llama a la API al confirmar)
- [X] T025 [P] [US2] Agregar a `apps/web/e2e/kitchen.spec.ts`: `[004] AC-2.6` (dos páginas de cocina; "Preparar" en una se ve en la otra en menos de 3 s)

### Implementation for User Story 2

- [X] T026 [US2] Crear `apps/api/src/kitchen/kitchen-items.service.ts` con `advance(itemId, from, user)` y `undo(itemId, from, user)`: transacción con actualización condicionada por estado, historial, ventana de 30 min y errores `ITEM_STATE_CONFLICT`/`ITEM_VOIDED`/`UNDO_NOT_ALLOWED`; después del commit emite `kitchen:item-status-changed` a `role:KITCHEN` y `role:WAITER` (depende de T004, T005, T008)
- [X] T027 [US2] Agregar a `kitchen.controller.ts` `POST /kitchen/items/:itemId/advance` y `POST /kitchen/items/:itemId/undo` con `ZodValidationPipe` y `@Roles(Role.KITCHEN)` (depende de T026)
- [X] T028 [US2] Extender `kitchen-board.service.ts` con el estado `COMPLETED`, `completedAt` (último cambio a `READY`), la lista `completed` de los últimos 30 min y `canUndo` por ítem (depende de T014)
- [X] T029 [P] [US2] Agregar a `apps/web/src/features/kitchen/api.ts` `useAdvanceItem()` y `useUndoItem()`; ante 409, mostrar el mensaje en español y volver a pedir el tablero; escuchar `kitchen:item-status-changed`
- [X] T030 [US2] Agregar a `TicketItemRow.tsx` los botones "Preparar", "Listo" y "Deshacer" (≥ 44×44 px, uno visible por estado) con confirmación para "Deshacer" reutilizando `apps/web/src/components/Modal.tsx`, y crear `CompletedSection.tsx` (depende de T029)

**Checkpoint**: US1 y US2 funcionan juntas; la cocina ya reemplaza la comanda de papel.

---

## Phase 5: User Story 3 - Avisar al mozo cuando un plato está listo (Priority: P2)

**Goal**: el mozo responsable recibe el aviso en cualquier pantalla y lo cierra con "Visto".

**Independent Test**: se marca un ítem "Listo" y se verifica destinatario, persistencia,
"Visto" y retiro al deshacer.

### Tests for User Story 3 ⚠️

- [X] T031 [P] [US3] Escribir en `apps/api/test/acceptance/ready-notices.acceptance.spec.ts`: `[004] AC-3.2` (`seen` cierra el aviso y deja de salir en `GET /api/kitchen/ready-notices`; repetirlo responde 204); `[004] AC-3.3` (un aviso creado sin el mozo conectado aparece en su `GET`); `[004] AC-3.4` (`undo` desde `READY` fija `withdrawnAt`); `[004] AC-3.5` (Juan abrió la mesa y Rosa envió la ronda: el aviso es para Juan; Rosa recibe una lista vacía y 403 al marcar el de Juan como visto)
- [X] T032 [P] [US3] Agregar a `kitchen-items.acceptance.spec.ts`: `[004] AC-2.8` (aviso visto → `undo` desde `READY` responde 409 `READY_ALREADY_SEEN` con "El mozo ya recogió este plato")
- [X] T033 [P] [US3] Agregar a `kitchen-realtime.acceptance.spec.ts`: `[004] AC-3.1` (el socket de Juan recibe `kitchen:ready-notice` con mesa, plato y cantidad); `[004] AC-3.5` (el socket de Rosa no lo recibe)
- [X] T034 [P] [US3] Escribir `apps/web/src/features/kitchen/ready-notices/ReadyNoticesTray.test.tsx`: `[004] AC-3.1` (muestra "Mesa 5: 2 × Ají de gallina — listo"); `[004] AC-3.2` ("Visto" lo quita y llama a la API)
- [X] T035 [P] [US3] Agregar a `apps/web/e2e/kitchen.spec.ts`: `[004] AC-3.1` (cocina marca Listo y la página `/mozo` de Juan muestra el aviso sin recargar)

### Implementation for User Story 3

- [X] T036 [US3] Extender `kitchen-items.service.ts`: al pasar a `READY`, crear `ReadyNotice` para `Order.waiterId` con `quantity = toPrepare` y emitir `kitchen:ready-notice` a `user:<id>`; al deshacer un `READY`, rechazar con `READY_ALREADY_SEEN` si el aviso está visto o fijar `withdrawnAt` y emitir `kitchen:ready-notice-closed` con `UNDONE` (depende de T026)
- [X] T037 [US3] Crear `apps/api/src/kitchen/ready-notices.service.ts` y `ready-notices.controller.ts` con `GET /kitchen/ready-notices` y `POST /kitchen/ready-notices/:noticeId/seen` (`@Roles(Role.WAITER)`, solo el destinatario, idempotente, emite `kitchen:ready-notice-closed` con `SEEN`) (depende de T036)
- [X] T038 [P] [US3] Crear `apps/web/src/features/kitchen/ready-notices/api.ts` (`useReadyNotices`, `useMarkSeen`, escucha `kitchen:ready-notice` y `kitchen:ready-notice-closed`) y `ReadyNoticesTray.tsx` (lista fija y visible, botón "Visto" de ≥ 44 px)
- [X] T039 [US3] Montar `<ReadyNoticesTray />` en `apps/web/src/app/AppShell.tsx` solo para el rol mozo (depende de T038)

**Checkpoint**: el mozo ya no tiene que ir a preguntar a cocina.

---

## Phase 6: User Story 4 - Ver el tiempo de espera y detectar demoras (Priority: P2)

**Goal**: minutos de espera visibles y marcas "Demorado" / "Muy demorado".

**Independent Test**: con reloj controlado se cruzan los umbrales de 15 y 25 minutos.

### Tests for User Story 4 ⚠️

- [X] T040 [P] [US4] Agregar a `KitchenBoardPage.test.tsx` con relojes falsos: `[004] AC-4.1` (el contador sube sin recargar); `[004] AC-4.2` (a los 15 min "Demorado", a los 25 min "Muy demorado", siempre con texto)
- [X] T041 [P] [US4] Agregar a `kitchen-board.acceptance.spec.ts`: `[004] AC-4.3` (una comanda completada trae `completedAt` y su tiempo total `completedAt − sentAt`)

### Implementation for User Story 4

- [X] T042 [P] [US4] Crear `apps/web/src/features/kitchen/useServerClock.ts` (desfase con `serverTime`, recalcula cada 15 s) y `WaitBadge.tsx` (minutos, ámbar ≥ 15, rojo ≥ 25, texto siempre visible, contraste AA)
- [X] T043 [US4] Mostrar `WaitBadge` en `TicketCard.tsx` (activas) y el tiempo total en `CompletedSection.tsx` (depende de T042)

---

## Phase 7: User Story 5 - Enterarse de los platos anulados (Priority: P3)

**Goal**: la cocina ve cada anulación, total o parcial, y la confirma con "Entendido".

**Independent Test**: se anula un ítem completo y una unidad de otro desde la 003 y se
verifica la comanda, el aviso y la confirmación.

### Tests for User Story 5 ⚠️

- [X] T044 [P] [US5] Agregar a `kitchen-board.acceptance.spec.ts`: `[004] AC-5.1` (ítem con todas sus unidades anuladas → `VOIDED`; `advance` responde 409 `ITEM_VOIDED`); `[004] AC-5.2` (3 rocotos, 1 anulado → `toPrepare: 2`, `voidedQuantity: 1`, mismo estado); `[004] AC-5.3` (con un ítem anulado, la comanda se completa al quedar listos los demás); `[004] AC-5.4` (comanda totalmente anulada sigue en `active` con estado `VOIDED` hasta confirmar todas sus anulaciones)
- [X] T045 [P] [US5] Agregar a `kitchen-realtime.acceptance.spec.ts`: `[004] AC-5.5` (la anulación aparece en `voidNotices`; `ack` responde 204, es idempotente y emite `kitchen:void-acknowledged` a otro socket de cocina)
- [X] T046 [P] [US5] Agregar a `KitchenBoardPage.test.tsx`: `[004] AC-5.1` (ítem tachado con "ANULADO" y sin botones); `[004] AC-5.2` ("2 × Rocoto relleno" con "1 anulada"); `[004] AC-5.5` (aviso "Mesa 4: 1 × Rocoto relleno anulado" arriba, con sonido, hasta tocar "Entendido")

### Implementation for User Story 5

- [X] T047 [US5] Extender `kitchen-board.service.ts` con `voidNotices` (anulaciones sin `KitchenVoidAck`, en orden de llegada) y el estado `VOIDED` de la comanda mientras falte alguna confirmación (depende de T014)
- [X] T048 [US5] Agregar a `kitchen.controller.ts` `POST /kitchen/void-notices/:itemVoidId/ack` (`@Roles(Role.KITCHEN)`, idempotente con `createMany` y `skipDuplicates` en `void-notices.service.ts`) que emite `kitchen:void-acknowledged` a `role:KITCHEN` (depende de T047)
- [X] T049 [P] [US5] Crear `apps/web/src/features/kitchen/VoidNoticesBar.tsx` (avisos apilados arriba, sonido al aparecer uno nuevo, botón "Entendido") y agregar `useAcknowledgeVoid()` en `api.ts`
- [X] T050 [US5] Mostrar en `TicketItemRow.tsx` el ítem anulado (tachado, "ANULADO", sin botones) y la anulación parcial ("N × plato" con "M anulada(s)"), y en `TicketCard.tsx` el estado "Comanda anulada" (depende de T049)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T051 [P] Verificación de tablet (Principio IV): `/cocina` sin desplazamiento horizontal en 768×1024 y 1366×1024 y botones de al menos 44×44 px. La cubre `apps/web/e2e/tablet.spec.ts` de la 001, que ya recorre `/cocina` y ahora prueba la pantalla real
- [X] T052 [P] Revisar que todos los textos nuevos estén en español y que las horas usen `es-PE` (Principio III)
- [X] T053 Ejecutar `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` y `npm run check:ac -- 004` (resultado esperado: 28/28)
- [X] T054 Recorrer la validación manual de [quickstart.md](quickstart.md) y guardar capturas para el informe (sección 5.3)
- [ ] T055 Abrir el PR de `004-cocina` hacia `main` con la lista de comprobación de puertas de calidad y asignar la revisión al responsable de la 003

---

## Dependencies & Execution Order

### Phase Dependencies

- **Requisito externo**: migración de la 003 en `main` → T001.
- **Setup (Phase 1)** → **Foundational (Phase 2)** → historias.
- **US1 (P1)**: depende solo de Foundational. Es el MVP.
- **US2 (P1)**: depende de US1 (botones sobre la comanda y tablero).
- **US3 (P2)**: depende de US2 (el aviso nace al marcar "Listo").
- **US4 (P2)**: depende solo de US1; puede ir en paralelo con US2 y US3.
- **US5 (P3)**: depende de US1 y del endpoint de anulación de la 003.
- **Polish (Phase 8)**: al final.

### Within Each User Story

- Pruebas primero; deben fallar antes de implementar.
- Servicio → controlador → hooks del cliente → componentes.

### Parallel Opportunities

- T005, T006, T007, T009 y T010 en paralelo (archivos distintos).
- En cada historia, todas las tareas de prueba [P] en paralelo.
- US4 en paralelo con US2/US3 si hay dos personas.

## Parallel Example: User Story 1

```bash
Task: "T011 [004] AC-1.2/1.4/1.5/1.6/1.7 en kitchen-board.acceptance.spec.ts"
Task: "T012 [004] AC-1.1/1.3/1.4 en KitchenBoardPage.test.tsx"
Task: "T013 [004] AC-1.3 en e2e/kitchen.spec.ts"
Task: "T016 useKitchenBoard en features/kitchen/api.ts"
Task: "T017 TicketCard y TicketItemRow"
Task: "T018 sound.ts y useNewTicketAlert.ts"
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phases 1 y 2.
2. Phase 3 (US1) → validar pasos 1–3 de [quickstart.md](quickstart.md).
3. Demostrable: la cocina ve las comandas en tiempo real.

### Incremental Delivery

1. US1 → US2: la cocina trabaja sin papel.
2. US3: avisos al mozo.
3. US4: tiempos de espera.
4. US5: anulaciones.
5. Polish y un único PR.
