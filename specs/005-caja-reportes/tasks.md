---

description: "Lista de tareas de la feature 005-caja-reportes"
---

# Tasks: Caja y reportes

**Input**: Design documents from `/specs/005-caja-reportes/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: OBLIGATORIAS (Principio II de la constitución). Cada prueba de aceptación empieza su
título con `[005] AC-x.y`. Las pruebas de cada historia se escriben primero y deben fallar antes
de implementar.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Rama**: `005-caja-reportes`; un único PR al terminar la feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monorepo existente: `apps/api/` (NestJS), `apps/web/` (React + Vite), `packages/shared/`. El
módulo nuevo es `apps/api/src/billing/`. Reutiliza de la 003, sin modificarlos: `order-mapper.ts`,
`order-locks.ts`, `idempotency-key.decorator.ts`, `TablesService` (`MenuModule`) y los helpers
de `apps/api/test/helpers/order-factories.ts` y `realtime.ts` ([contracts/dependencias-003.md](contracts/dependencias-003.md)).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Registrar el módulo nuevo y la cobertura de criterios en CI.

- [X] T001 Agregar `005` a la lista de features del paso `check:ac` en `.github/workflows/ci.yml`, conservando las que ya estén (por ejemplo, `npm run check:ac -- 001 002 005`)
- [X] T002 Crear `apps/api/src/billing/billing.module.ts` (importa `PrismaModule`, `MenuModule` y `RealtimeModule`; sin controladores todavía) y registrarlo en `apps/api/src/app.module.ts` después de `OrdersModule`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modelo de datos, contratos compartidos, cálculos puros, lectura de la cuenta y
auxiliares de prueba que usan todas las historias.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Base de datos

- [X] T003 Agregar a `apps/api/prisma/schema.prisma` los enums `PaymentMethod` (`CASH`, `YAPE_PLIN`, `CARD`), `PaymentStatus` (`VALID`, `VOIDED`) y `SplitMode` (`EQUAL`, `BY_ITEMS`) y los modelos de [data-model.md](data-model.md): `Payment` (`amount` `Decimal(10,2)` "aplicado a la cuenta"; `receivedAmount` y `changeAmount` `Decimal(10,2)?` "solo CASH"; `reference` `VarChar(40)?`; `idempotencyKey` UUID `@unique`; `partId`, `closureId`, `voidedById` opcionales; `voidReason` `VarChar(200)?`; `paidAt`, `voidedAt`), `BillSplit` (`baseAmount` "saldo pendiente al dividir", `supersededAt?` "null = vigente"), `BillPart` (`position`, `label` `VarChar(30)`, `amount`), `BillPartItem` (`units`), `DayClosure` (`startedAt`, `closedAt`, `expectedCash`/`countedCash`, `expectedYapePlin`/`countedYapePlin`, `expectedCard`/`countedCard`, `total`, `accountsCount`, `notes` `VarChar(300)?`), con `@@map` en snake_case, relaciones con nombre hacia `User` (cajero, anuló, dividió, cerró) y los campos inversos en `Order`, `OrderItem` y `User`
- [X] T004 Generar la migración `apps/api/prisma/migrations/20261029000004_billing/migration.sql` (con `prisma migrate dev --create-only --name billing`, o `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` con base sombra si no es interactivo) y agregar a mano: `CHECK (amount > 0)`; `CHECK ((method = 'CASH') = (received_amount IS NOT NULL))`; `CHECK (received_amount IS NULL OR received_amount >= amount)`; `CHECK (units >= 1)` en `bill_part_items`; índice único parcial `bill_splits_one_active_per_order ON bill_splits(order_id) WHERE superseded_at IS NULL`; índices `payments(order_id, status)`, `payments(closure_id)`, `payments(paid_at)` y `orders(status, closed_at)`. Aplicarla con `npm run db:migrate`
- [X] T005 Agregar al inicio de `resetDb` en `apps/api/test/helpers/db.ts` el borrado de `payment`, `billPartItem`, `billPart`, `billSplit` y `dayClosure` (antes de `itemVoid`), por las claves foráneas

### Contratos compartidos

- [X] T006 [P] Agregar a `packages/shared/src/errors.ts` los códigos y mensajes: `BILL_NOT_REQUESTED` "El mozo debe pedir la cuenta antes de cobrar", `PAYMENT_EXCEEDS_BALANCE` "El monto supera el saldo pendiente", `INSUFFICIENT_CASH` "El monto recibido no alcanza para cubrir el pago", `PAYMENT_NOT_VOIDABLE` "Este pago ya no se puede anular", `SPLIT_UNASSIGNED_UNITS` "Asigna todas las unidades antes de confirmar la división", `SPLIT_INVALID_ASSIGNMENT` "Hay unidades asignadas de más o ítems que no son de esta cuenta", `SPLIT_STALE` "La cuenta cambió desde que se dividió. Vuelve a dividir el saldo.", `ACCOUNT_HAS_BALANCE` "La cuenta tiene saldo pendiente; regístralo como pago", `CLOSURE_OPEN_TABLES` "No puedes cerrar con mesas abiertas", `CLOSURE_NOTES_REQUIRED` "Explica las diferencias en la observación antes de cerrar", `INVALID_DATE_RANGE` "Elige un rango válido de hasta 366 días"
- [X] T007 [P] Agregar a `packages/shared/src/events.ts` `BILLING_ACCOUNT_UPDATED: 'billing:account-updated'`, la interfaz `AccountUpdatedPayload` (`orderId`, `tableNumber`, `reason: 'PAYMENT_CREATED' | 'PAYMENT_VOIDED' | 'SPLIT_CREATED' | 'PAID' | 'CLOSED_WITHOUT_CHARGE'`, `pending: Money`, `changedAt`) y su entrada en `ServerToClientEvents` ([contracts/websocket-events.md](contracts/websocket-events.md))
- [X] T008 [P] Crear `packages/shared/src/schemas/billing.ts` (y exportarlo desde `packages/shared/src/index.ts`) según [contracts/rest-api.yaml](contracts/rest-api.yaml), reutilizando `moneySchema` y `userRefSchema` de `schemas/orders.ts`: `PAYMENT_METHODS` con `PAYMENT_METHOD_LABELS` ("Efectivo", "Yape/Plin", "Tarjeta"); `createPaymentSchema` (`amount` > 0 con hasta 2 decimales; `receivedAmount` obligatorio solo con `CASH`; `reference` hasta 40 caracteres solo con `YAPE_PLIN` o `CARD`; `partId` uuid opcional; estricto); `voidPaymentSchema` (`reason` 3 a 200 caracteres); `createSplitSchema` (unión discriminada por `mode`: `EQUAL` con `parts` entero 2 a 20; `BY_ITEMS` con 2 a 20 partes, cada una con `label` opcional hasta 30 caracteres e `items` no vacío de `{ orderItemId: uuid, units: entero ≥ 1 }`); `closureCountsSchema` (tres montos ≥ 0 con hasta 2 decimales); `confirmClosureSchema` (+ `notes` 5 a 300 caracteres opcional); `dateRangeQuerySchema` (`from` y `to` con formato `YYYY-MM-DD`) y `topDishesQuerySchema` (`sortBy` `units` o `amount`, por defecto `units`); y los esquemas de respuesta `accountSummarySchema`, `accountItemSchema`, `paymentSchema`, `billPartSchema`, `accountDetailSchema`, `closureLineSchema`, `closureSummarySchema`, `dayClosureSchema`, `salesReportSchema` y `topDishSchema`, con mensajes de validación en español

### Cálculos y lectura de la cuenta

- [X] T009 [P] Crear `apps/api/src/billing/billing-math.ts` (funciones puras en céntimos) y sus pruebas en `apps/api/src/billing/billing-math.spec.ts`: `splitEqually(pendingCents, parts)` (monto = ⌊saldo / n⌋ y los céntimos sobrantes a la parte 1; la suma es el saldo); `validateAssignment(available, parts)` (devuelve unidades sin asignar y asignadas de más por ítem); `assignedAmountCents(parts, unitPrices)`; `changeCents(amountCents, receivedCents)`; `closureLines(expected, counted)` (diferencia = contado − registrado por método y `hasDifferences`); `isSplitStale(totalCents, baseCents, paidBeforeSplitCents)` ([research.md §6](research.md))
- [X] T010 Crear `apps/api/src/billing/account-mapper.ts` con `ACCOUNT_INCLUDE` (mesa, mozo, ítems con `ORDER_ITEM_INCLUDE` de la 003, pagos con cajero y quien anuló, división vigente con partes, ítems y pagos) y `toAccountDetail(record)`: ítems enviados no `DRAFT` con unidades vigentes, anuladas, `unitPrice` y `subtotal`; total con `consumptionCents`; pagado = Σ pagos `VALID`; saldo = total − pagado; división con `paid`/`pending` por parte e `isStale`; `canCharge` (mesa `POR_COBRAR`, saldo > 0 y división no desactualizada) y `canCloseWithoutCharge` (mesa `POR_COBRAR` y total 0); y `toAccountSummary` (depende de T003, T008, T009)
- [X] T011 Crear `apps/api/test/helpers/billing-factories.ts` con `createBillableOrder(prisma, { waiterId, tableNumber?, tableStatus = 'POR_COBRAR', items: Array<{ name?, price, quantity, voidedQuantity? }> })`, armado con `createOpenOrder`, `createMenuItem`, `createDispatch` y `createSentItem` de `order-factories.ts`, y `pay(agent, orderId, body, key = randomUUID())`, que envía la cabecera `Idempotency-Key` (depende de T003, T005)

### Frontend común

- [X] T012 [P] Crear `apps/web/src/features/billing/api.ts` con las claves de consulta `BILLING_KEYS` y los hooks de lectura `usePendingAccounts()` (`GET /api/billing/accounts`) y `useAccount(orderId)` (`GET /api/billing/accounts/:orderId`, `refetchOnWindowFocus`), validando con los esquemas de T008; y `apps/web/src/features/billing/useBillingRealtime.ts`, que con el socket de `RealtimeProvider` invalida esas consultas ante `orders:table-status-changed`, `orders:item-voided` y `billing:account-updated`

**Checkpoint**: la base está lista; las historias pueden empezar.

---

## Phase 3: User Story 1 - Cobrar la cuenta completa de una mesa (Priority: P1) 🎯 MVP

**Goal**: el cajero ve en vivo las mesas por cobrar, abre la cuenta sin lo anulado y la cobra con
efectivo (con vuelto), Yape/Plin o tarjeta; la mesa queda libre para todos.

**Independent Test**: con una mesa por cobrar con unidades anuladas, cobrar con cada método y
comprobar total, vuelto, mesa libre en la vista del mozo y rechazo de mozo y cocina.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T013 [P] [US1] Escribir `apps/api/test/acceptance/billing-accounts.acceptance.spec.ts`: `[005] AC-1.2` (ítem de 3 unidades con 1 anulada y otro anulado del todo: subtotales, unidades anuladas y total sin lo anulado); `[005] AC-1.3` (efectivo por el total con `receivedAmount` mayor: `changeAmount`, pedido `PAID` con `closedAt`, mesa `LIBRE`); `[005] AC-1.4` (Yape/Plin y tarjeta con `reference`); `[005] AC-1.5` (efectivo con `receivedAmount` menor → 409 `INSUFFICIENT_CASH`, sin pago); `[005] AC-1.6` (mesa `OCUPADA` → 409 `BILL_NOT_REQUESTED`); `[005] AC-1.8` (mozo y cocina → 403 en `GET /api/billing/accounts` y en `POST …/payments`). Casos sin ID: reintento con la misma `Idempotency-Key` devuelve el mismo resultado sin duplicar el pago (y con otro cuerpo → `IDEMPOTENCY_KEY_REUSED`); monto mayor que el saldo → `PAYMENT_EXCEEDS_BALANCE`; cuenta pagada → `ORDER_NOT_OPEN` (FR-010); `close-without-charge` con total 0 libera la mesa y con saldo → `ACCOUNT_HAS_BALANCE` (FR-009)
- [X] T014 [P] [US1] Escribir `apps/api/test/acceptance/billing-realtime.acceptance.spec.ts` con los helpers de `apps/api/test/helpers/realtime.ts` y el flujo real de la 003: `[005] AC-1.1` (un mozo pide la cuenta con `POST /api/orders/:id/request-bill` y el socket del cajero recibe `orders:table-status-changed` con `POR_COBRAR`; `GET /api/billing/accounts` la lista con total y saldo); `[005] AC-1.7` (con la mesa por cobrar, el mozo agrega un ítem con `confirmReopen: true`, el cajero recibe `OCUPADA` y un pago → 409 `BILL_NOT_REQUESTED`); al completar el pago, el socket de un mozo recibe `LIBRE` y el del cajero `billing:account-updated` con `reason: 'PAID'`
- [X] T015 [P] [US1] Escribir `apps/web/src/features/billing/PaymentForm.test.tsx` y `apps/web/src/features/billing/AccountPage.test.tsx` (MSW): el vuelto se calcula al escribir el monto recibido; "Referencia" solo aparece con Yape/Plin o tarjeta; los ítems anulados aparecen con la etiqueta "Anulado" y no suman; cobrar el saldo completo pide confirmación; con la mesa `OCUPADA` se ve "El mozo agregó pedidos. Espera a que vuelva a pedir la cuenta." y el botón "Cobrar" está deshabilitado
- [X] T016 [P] [US1] Escribir `apps/web/e2e/billing.spec.ts` (US1): `[005] AC-1.1` (`mozo.e2e` abre una mesa, toma y envía un plato y pide la cuenta en `/mozo`; `caja.e2e` la ve en `/caja` sin recargar); `[005] AC-1.3` (el cajero cobra en efectivo con un monto recibido mayor, ve el vuelto y la mesa aparece "Libre" para el mozo); `[005] AC-1.8` (`mozo.e2e` abre `/caja` y ve "No tienes permiso para ver esta pantalla")

### Implementation for User Story 1

- [X] T017 [US1] Implementar `apps/api/src/billing/accounts.service.ts`: `listPending()` (pedidos `OPEN` con mesa `POR_COBRAR`, por número de mesa); `getAccount(orderId)` (404 "El pedido no existe"); `createPayment(orderId, input, idempotencyKey, cashier)` en una transacción: `lockOpenOrder` → mesa `POR_COBRAR` o `BILL_NOT_REQUESTED` → respuesta previa si la clave ya existe (o `IDEMPOTENCY_KEY_REUSED` si cambió el cuerpo) → `amount ≤ saldo` → en efectivo `receivedAmount ≥ amount` y `changeAmount` → insertar → si el saldo llega a 0, pedido `PAID` con `closedAt` y `TablesService.transition(tx, tableId, ['POR_COBRAR'], 'LIBRE')`; tras confirmar, `emitToRoles(['WAITER', 'CASHIER'], 'orders:table-status-changed', …)` si se liberó y `emitToRoles(['CASHIER'], 'billing:account-updated', …)`; `closeWithoutCharge(orderId)` (total 0 o `ACCOUNT_HAS_BALANCE`)
- [X] T018 [US1] Implementar `apps/api/src/billing/accounts.controller.ts` con `@Roles('CASHIER')`: `GET /billing/accounts`, `GET /billing/accounts/:orderId`, `POST /billing/accounts/:orderId/payments` (201, `@IdempotencyKey()` de la 003, `ZodValidationPipe(createPaymentSchema)`) y `POST /billing/accounts/:orderId/close-without-charge` (200); registrarlo con `AccountsService` en `billing.module.ts` (depende de T017)
- [X] T019 [P] [US1] Agregar a `apps/web/src/features/billing/api.ts` las mutaciones `useCreatePayment(orderId)` (genera una `Idempotency-Key` por intento de cobro y la reutiliza en los reintentos) y `useCloseWithoutCharge(orderId)`, que invalidan `BILLING_KEYS`
- [X] T020 [P] [US1] Crear `apps/web/src/features/billing/PendingAccountsPage.tsx` (`/caja`): tarjetas "Mesa N" con mozo, total y saldo, en vivo con `useBillingRealtime`, mensaje "No hay mesas por cobrar" si está vacía, y enlaces "Cierre del día" y "Historial de cierres"; áreas táctiles de 44 px
- [X] T021 [P] [US1] Crear `apps/web/src/features/billing/PaymentForm.tsx`: "Método" (Efectivo, Yape/Plin, Tarjeta), "Monto" (por defecto, el saldo o lo que falta de la parte), "Monto recibido" y "Vuelto" solo en efectivo, "Referencia" solo en Yape/Plin y tarjeta; validación con `createPaymentSchema`; errores de la API en español
- [X] T022 [US1] Crear `apps/web/src/features/billing/AccountPage.tsx` (`/caja/cuentas/:orderId`): encabezado "Mesa N" con mozo; tabla de ítems con "Anulado" tachado; total, pagado y saldo; lista de pagos; `PaymentForm` y confirmación antes de cobrar el saldo completo (FR-028, con el `ConfirmDialog` de `features/users`); "Cerrar sin cobro" si `canCloseWithoutCharge`; aviso de mesa `OCUPADA` con cobro deshabilitado; al quedar pagada, mensaje "Cuenta pagada. La mesa N quedó libre." y vuelta a `/caja` (depende de T019, T021)
- [X] T023 [US1] En `apps/web/src/app/router.tsx`, reemplazar `CashierHome` por `PendingAccountsPage` en `/caja` y agregar `/caja/cuentas/:orderId` → `AccountPage`; montar `useBillingRealtime` en ambas pantallas (depende de T020, T022)

**Checkpoint**: US1 funciona por sí sola y reemplaza al sustituto `simulateCashierPayment` de la 003 en el uso real.

---

## Phase 4: User Story 2 - Dividir la cuenta entre varios clientes (Priority: P2)

**Goal**: dividir el saldo en partes iguales o por ítems, cobrar cada parte con su método y
anular un pago hecho por error.

**Independent Test**: dividir una cuenta, pagar partes con métodos distintos y comprobar que la
mesa sigue por cobrar con saldo y se libera al completar el total.

### Tests for User Story 2 ⚠️

- [X] T024 [P] [US2] Escribir `apps/api/test/acceptance/billing-split.acceptance.spec.ts`: `[005] AC-2.1` (S/ 100.00 en 3 partes → 33.34, 33.33, 33.33); `[005] AC-2.2` (por ítems: partes con sus montos; con unidades sin asignar → `SPLIT_UNASSIGNED_UNITS` con `details.unassigned`; con unidades de más o un ítem de otra cuenta → `SPLIT_INVALID_ASSIGNMENT`); `[005] AC-2.3` (pagar una parte: saldo actualizado y mesa por cobrar); `[005] AC-2.4` (última parte con otro método: `PAID` y mesa `LIBRE`); `[005] AC-2.5` (Yape/Plin o tarjeta por encima del saldo → `PAYMENT_EXCEEDS_BALANCE` con `details.pending`); `[005] AC-2.6` (con pagos parciales, el mozo agrega con `confirmReopen` y vuelve a pedir la cuenta: pagos conservados, saldo con lo agregado y división `isStale`; cobrar una parte → `SPLIT_STALE`); `[005] AC-2.7` (anular un pago con motivo: deja de contar, queda `VOIDED` con motivo y quien lo anuló; anular en una cuenta pagada → `PAYMENT_NOT_VOIDABLE`). Caso sin ID: volver a dividir reemplaza la división anterior y reparte solo el saldo pendiente
- [X] T025 [P] [US2] Escribir `apps/web/src/features/billing/SplitDialog.test.tsx` (MSW): la pestaña "Partes iguales" muestra el monto de cada parte; la pestaña "Por ítems" muestra el contador de unidades sin asignar y no deja confirmar mientras sea mayor que cero
- [X] T026 [P] [US2] Agregar a `apps/web/e2e/billing.spec.ts` `[005] AC-2.1`: el cajero divide en 2 partes iguales una cuenta pedida por el mozo, paga una con Yape/Plin y la otra en efectivo, y la mesa se libera

### Implementation for User Story 2

- [X] T027 [US2] Crear `apps/api/src/billing/splits.service.ts`: `createSplit(orderId, input, cashier)` en una transacción con `lockOpenOrder`: mesa `POR_COBRAR` (o `BILL_NOT_REQUESTED`), saldo > 0, marcar la división vigente con `supersededAt`, y crear la nueva sobre el saldo pendiente con `splitEqually` o, en `BY_ITEMS`, con `validateAssignment` sobre las unidades vigentes no pagadas (`SPLIT_UNASSIGNED_UNITS` o `SPLIT_INVALID_ASSIGNMENT`) y montos con `assignedAmountCents`; emitir `billing:account-updated` con `SPLIT_CREATED`
- [X] T028 [US2] Extender `createPayment` en `apps/api/src/billing/accounts.service.ts` con `partId`: la parte debe ser de la división vigente, la división no debe estar desactualizada (`SPLIT_STALE`) y el monto no puede superar lo que falta de la parte; y agregar `voidPayment(orderId, paymentId, reason, cashier)` (pedido `OPEN` y pago `VALID`, o `PAYMENT_NOT_VOIDABLE`; emite `PAYMENT_VOIDED`)
- [X] T029 [US2] Agregar a `apps/api/src/billing/accounts.controller.ts` `POST /billing/accounts/:orderId/split` (`createSplitSchema`) y `POST /billing/accounts/:orderId/payments/:paymentId/void` (`voidPaymentSchema`); registrar `SplitsService` en `billing.module.ts` (depende de T027, T028)
- [X] T030 [P] [US2] Agregar a `apps/web/src/features/billing/api.ts` las mutaciones `useCreateSplit(orderId)` y `useVoidPayment(orderId)`
- [X] T031 [P] [US2] Crear `apps/web/src/features/billing/SplitDialog.tsx`: pestañas "Partes iguales" (cantidad de personas de 2 a 20, montos calculados) y "Por ítems" (asignar unidades de cada ítem a cada parte con botones + y − de 44 px, contador "Unidades sin asignar: N"); en una división desactualizada por ítems, partir de las asignaciones anteriores y dejar sin asignar solo las unidades nuevas
- [X] T032 [P] [US2] Crear `apps/web/src/features/billing/VoidPaymentDialog.tsx`: "Anular pago", motivo obligatorio (3 a 200 caracteres) y confirmación
- [X] T033 [US2] Integrar en `apps/web/src/features/billing/AccountPage.tsx` el botón "Dividir cuenta", la lista de partes con su estado ("Pagada" o saldo) y "Cobrar esta parte", el aviso "La cuenta cambió desde que se dividió" con la acción de volver a dividir, y "Anular" en cada pago vigente mientras la cuenta no esté pagada (depende de T030 a T032)

**Checkpoint**: US1 y US2 funcionan cada una por sí sola.

---

## Phase 5: User Story 3 - Hacer el cierre del día (Priority: P2)

**Goal**: cierre con conteo a ciegas por método, diferencias con observación obligatoria y
historial; no se puede cerrar con mesas abiertas.

**Independent Test**: tras cobros con los tres métodos, cerrar con una diferencia en efectivo y
comprobar diferencias, observación exigida, cierre guardado y que un cobro posterior no lo cambia.

### Tests for User Story 3 ⚠️

- [X] T034 [P] [US3] Escribir `apps/api/test/acceptance/billing-closures.acceptance.spec.ts`: `[005] AC-3.1` (`POST /billing/closures/preview` sin montos contados → 400; con montos, responde lo registrado); `[005] AC-3.2` (cobros con los tres métodos y un pago anulado: registrado por método sin lo anulado, diferencias, total y cantidad de cuentas); `[005] AC-3.3` (con diferencia y sin `notes` → `CLOSURE_NOTES_REQUIRED`; con `notes` → 201); `[005] AC-3.4` (un cobro posterior al cierre no cambia el cierre guardado y aparece en el siguiente); `[005] AC-3.5` (con una mesa ocupada y otra por cobrar → `CLOSURE_OPEN_TABLES` con `details.tables`); `[005] AC-3.6` (`GET /billing/closures` más reciente primero, para cajero y administrador). Caso sin ID: dos cierres a la vez crean uno solo con los pagos
- [X] T035 [P] [US3] Escribir `apps/web/src/features/billing/ClosurePage.test.tsx` (MSW): el paso 1 no muestra montos registrados antes de enviar lo contado (conteo a ciegas, AC-3.1); el paso 2 muestra "Registrado", "Contado" y "Diferencia", y exige la observación si hay diferencias
- [X] T036 [P] [US3] Agregar a `apps/web/e2e/billing.spec.ts` `[005] AC-3.2`: con todas las mesas libres, `caja.e2e` ingresa lo contado con una diferencia en efectivo, ve la tabla de diferencias, escribe la observación, confirma y el cierre aparece en `/caja/cierres`

### Implementation for User Story 3

- [X] T037 [US3] Crear `apps/api/src/billing/closures.service.ts`: `preview(counts)` y `confirm(counts, notes, cashier)` en una transacción con `pg_advisory_xact_lock(5005)`: rechazar si hay pedidos `OPEN` (`CLOSURE_OPEN_TABLES` con los números de mesa); registrado por método = Σ pagos `VALID` con `closureId` nulo; `closureLines`; exigir `notes` si hay diferencias; `startedAt` = `closedAt` del cierre anterior o `paidAt` del primer pago sin cierre; `accountsCount` = pedidos distintos de esos pagos; crear `DayClosure` y asignarle todos los pagos sin cierre (también los anulados); y `history()`
- [X] T038 [US3] Crear `apps/api/src/billing/closures.controller.ts` con `@Roles('CASHIER')`: `POST /billing/closures/preview`, `POST /billing/closures` (201) y `GET /billing/closures`; registrar `ClosuresService` en `billing.module.ts` (depende de T037)
- [X] T039 [P] [US3] Agregar a `apps/web/src/features/billing/api.ts` `usePreviewClosure()`, `useConfirmClosure()` y `useClosures()`
- [X] T040 [P] [US3] Crear `apps/web/src/features/billing/ClosurePage.tsx` (`/caja/cierre`): paso 1 "Montos contados" (Efectivo, Yape/Plin, Tarjeta); paso 2 tabla "Registrado / Contado / Diferencia" (sobrante en verde, faltante en rojo), total, cuentas cobradas, "Observación" y "Confirmar cierre" con confirmación; con mesas abiertas, "No puedes cerrar con mesas abiertas" y la lista de mesas
- [X] T041 [P] [US3] Crear `apps/web/src/features/billing/ClosuresHistoryPage.tsx` (`/caja/cierres`): lista de cierres con fecha y hora (día/mes/año), cajero, montos por método, diferencias y observación
- [X] T042 [US3] Agregar a `apps/web/src/app/router.tsx` `/caja/cierre` → `ClosurePage` y `/caja/cierres` → `ClosuresHistoryPage` (depende de T040, T041)

**Checkpoint**: US1, US2 y US3 funcionan cada una por sí sola.

---

## Phase 6: User Story 4 - Ver los reportes de ventas (Priority: P3)

**Goal**: el administrador consulta total, cuentas, ticket promedio, ventas por día y por método
en un rango de fechas.

**Independent Test**: con cobros en varios días y métodos, consultar un rango y comprobar que
los totales coinciden con los pagos no anulados de cuentas pagadas.

### Tests for User Story 4 ⚠️

- [X] T043 [P] [US4] Escribir `apps/api/test/acceptance/reports.acceptance.spec.ts` (ventas): `[005] AC-4.1` (cuentas pagadas en 3 días: total, cantidad de cuentas y ticket promedio); `[005] AC-4.2` (total por día en zona de Perú, con un pago a las 23:30 de Lima en su día correcto, y los tres métodos siempre presentes); `[005] AC-4.3` (un pago anulado no suma; una cuenta cerrada sin cobro no cuenta); `[005] AC-4.4` (rango sin ventas: ceros y `byDay` vacío); `[005] AC-4.5` (cajero, mozo y cocina → 403). Casos sin ID: `from` posterior a `to` o rango mayor de 366 días → `INVALID_DATE_RANGE`
- [X] T044 [P] [US4] Actualizar las pruebas de la matriz de pantallas para incluir `/admin/reportes` (solo administrador): `packages/shared/src/roles.test.ts`, `apps/web/src/app/NavMenu.test.tsx` y el menú de `admin` en `apps/web/e2e/role-access.spec.ts` (Usuarios, Carta, Reportes, Mozo, Cocina, Caja)
- [X] T045 [P] [US4] Escribir `apps/web/src/features/reports/ReportsPage.test.tsx` (MSW): el rango por defecto es el mes actual; la pestaña "Ventas" muestra total, cuentas, ticket promedio y las tablas por día y por método; un rango sin ventas muestra "No hay ventas en este rango"
- [X] T046 [P] [US4] Escribir `apps/web/e2e/reports.spec.ts`: `[005] AC-4.5` (`caja.e2e` abre `/admin/reportes` y ve el aviso de permiso; `admin.e2e` ve "Reportes" en el menú y la pestaña "Ventas")

### Implementation for User Story 4

- [X] T047 [US4] Agregar `{ path: '/admin/reportes', label: 'Reportes', roles: [] }` a `APP_ROUTES` en `packages/shared/src/roles.ts`, después de `/admin/carta`
- [X] T048 [US4] Crear `apps/api/src/billing/reports.service.ts` con `sales(from, to)`: validar el rango (`INVALID_DATE_RANGE`); `$queryRaw` tipado sobre pedidos `PAID` con `closed_at` dentro de `[from 00:00, to + 1 día 00:00)` en `America/Lima` y sus pagos `VALID`: total, cuentas (pedidos con al menos un pago vigente), ticket promedio, total por día (`closed_at AT TIME ZONE 'America/Lima'`) y por método (los tres, en cero si no hay)
- [X] T049 [US4] Crear `apps/api/src/billing/reports.controller.ts` con `@Roles('ADMIN')` y `GET /reports/sales` (`dateRangeQuerySchema`); registrar `ReportsService` en `billing.module.ts` (depende de T048)
- [X] T050 [P] [US4] Crear `apps/web/src/features/reports/api.ts` (`useSalesReport(range)`) y `apps/web/src/features/reports/ReportsPage.tsx` (`/admin/reportes`): campos "Desde" y "Hasta", pestaña "Ventas" con indicadores (total, cuentas, ticket promedio) y tablas por día (día/mes/año) y por método, y "No hay ventas en este rango"; registrar la ruta en `apps/web/src/app/router.tsx`

**Checkpoint**: US4 funciona por sí sola.

---

## Phase 7: User Story 5 - Ver los platos más vendidos (Priority: P3)

**Goal**: ranking de platos por unidades o por monto en un rango, sin unidades anuladas y al
precio de envío.

**Independent Test**: con cuentas pagadas con varios platos y anulaciones, comprobar el orden y
que lo anulado no cuenta.

### Tests for User Story 5 ⚠️

- [X] T051 [P] [US5] Agregar a `apps/api/test/acceptance/reports.acceptance.spec.ts` (platos): `[005] AC-5.1` (ranking por unidades con `rank`, unidades y monto); `[005] AC-5.2` (`sortBy=amount` cambia el orden cuando un plato caro vende menos unidades); `[005] AC-5.3` (unidades anuladas y cuentas `OPEN` o `CANCELLED` no cuentan); `[005] AC-5.4` (el mismo plato enviado a S/ 28.00 y luego a S/ 30.00 suma cada unidad a su precio de envío)
- [X] T052 [P] [US5] Agregar a `apps/web/src/features/reports/ReportsPage.test.tsx` la pestaña "Platos más vendidos": orden "Por unidades" por defecto y cambio a "Por monto"

### Implementation for User Story 5

- [X] T053 [US5] Agregar a `apps/api/src/billing/reports.service.ts` `topDishes(from, to, sortBy)`: `$queryRaw` sobre `order_items` de pedidos `PAID` del rango con estado distinto de `DRAFT` y `VOIDED`, unidades = `quantity − voided_quantity` (> 0), monto = unidades × `unit_price`, agrupado por plato con su nombre actual, ordenado por unidades o por monto y desempatado por nombre; y `GET /reports/top-dishes` en `apps/api/src/billing/reports.controller.ts` (`topDishesQuerySchema`)
- [X] T054 [US5] Agregar a `apps/web/src/features/reports/api.ts` `useTopDishes(range, sortBy)` y a `apps/web/src/features/reports/ReportsPage.tsx` la pestaña "Platos más vendidos" con la tabla (puesto, plato, unidades, monto) y el selector "Por unidades" / "Por monto"

**Checkpoint**: las cinco historias funcionan cada una por sí sola.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: rendimiento, tablet, español y puertas de calidad.

- [X] T055 [P] Agregar a `apps/api/test/acceptance/reports.acceptance.spec.ts` una prueba de rendimiento sin ID (SC-007): con 5 000 cuentas pagadas en un año insertadas con `createMany`, `GET /reports/sales` y `GET /reports/top-dishes` de ese año responden en menos de 3 s
- [X] T056 [P] Ampliar `apps/web/e2e/tablet.spec.ts` con `/caja` y una cuenta en `/caja/cuentas/:orderId` creada con el flujo del mozo: sin desplazamiento horizontal en 768×1024 y 1366×1024 y controles de al menos 44×44 px
- [X] T057 Revisar que todos los textos nuevos de `apps/web/src/features/billing/`, `apps/web/src/features/reports/` y los mensajes de `packages/shared/src/errors.ts` y `schemas/billing.ts` estén en español, con montos `S/ 0.00` y fechas día/mes/año (Principio III, FR-027)
- [X] T058 Ejecutar desde la raíz los scripts de `package.json` `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` (con `docker compose up --build`) y `npm run check:ac -- 005`, y corregir hasta que todo pase y los 30 criterios figuren como cubiertos
- [ ] T059 Recorrer los 9 pasos de [quickstart.md § Recorrido manual](quickstart.md) en tablet con `mozo.e2e`, `caja.e2e` y `admin.e2e`, y corregir cualquier diferencia

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; BLOQUEA todas las historias. T003 → T004 → T005;
  T006 a T009 en paralelo; T010 depende de T003, T008 y T009; T011 de T003 y T005.
- **User Stories (Phase 3–7)**: dependen de Foundational.
- **Polish (Phase 8)**: depende de las historias que se quieran entregar.

### User Story Dependencies

- **US1 (P1)**: solo de Foundational. Es el MVP.
- **US2 (P2)**: usa `createPayment` y `AccountPage` de US1 (T017, T022): se implementa después
  de US1. Sus pruebas de API pueden escribirse en paralelo con US1.
- **US3 (P2)**: necesita pagos (T017); puede ir en paralelo con US2 (archivos distintos).
- **US4 (P3)** y **US5 (P3)**: solo necesitan pedidos pagados, que sus pruebas preparan con
  `createBillableOrder` y pagos directos en la base: pueden avanzar en paralelo con US1. US5
  extiende archivos de US4 (`reports.service.ts`, `ReportsPage.tsx`), así que va después.

### Within Each User Story

- Las pruebas se escriben primero y deben fallar antes de implementar.
- Servicio → controlador → hooks del frontend → pantallas → rutas.

### Parallel Opportunities

- Foundational: T006, T007, T008 y T009 a la vez; T012 en cuanto exista T008.
- US1: T013 a T016 a la vez; luego T019, T020 y T021.
- US2: T024 a T026 a la vez; luego T030, T031 y T032.
- US3: T034 a T036 a la vez; luego T039, T040 y T041.
- US4: T043 a T046 a la vez. US3 y US4 pueden avanzar en paralelo con dos personas.

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 (escribir primero, deben fallar):
Task: "T013 billing-accounts.acceptance.spec.ts"
Task: "T014 billing-realtime.acceptance.spec.ts"
Task: "T015 PaymentForm.test.tsx y AccountPage.test.tsx"
Task: "T016 billing.spec.ts (e2e)"

# Frontend de US1 una vez listo el backend (T017, T018):
Task: "T019 mutaciones en features/billing/api.ts"
Task: "T020 PendingAccountsPage.tsx"
Task: "T021 PaymentForm.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T034 billing-closures.acceptance.spec.ts"
Task: "T035 ClosurePage.test.tsx"
Task: "T036 cierre en billing.spec.ts (e2e)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 y Phase 2.
2. Phase 3 (US1): el cajero ya puede cobrar cuentas completas y liberar mesas.
3. **Detenerse y validar**: pasan `billing-accounts`, `billing-realtime`, sus pruebas de
   componentes y `billing.spec.ts` (US1). Desde aquí, el flujo real mozo → caja funciona.
4. Commit en la rama `005-caja-reportes`.

### Incremental Delivery

1. Setup + Foundational.
2. US1 → validar → commit (MVP).
3. US2 (dividir) y US3 (cierre) → validar → commit.
4. US4 y US5 (reportes) → validar → commit.
5. Polish → todas las puertas en verde → **un único PR** de `005-caja-reportes` hacia `main`.

### Parallel Team Strategy

- Persona A: US1 → US2.
- Persona B: US4 → US5 (solo dependen de Foundational).
- US3 en cuanto US1 tenga `createPayment`.

---

## Notes

- [P] = archivos distintos y sin dependencias pendientes.
- La etiqueta [USn] traza cada tarea a su historia de [spec.md](spec.md).
- Cada prueba de aceptación lleva `[005] AC-x.y` en su título.
- No se modifica código de la 003. Pedido pendiente al dueño de la 003: agregar `CASHIER` a los
  destinatarios de `orders:item-voided` en `voids.service.ts`. Cuando Caja esté en `main`, sus
  pruebas pueden reemplazar `simulateCashierPayment` (de `order-factories.ts`) por el cobro real.
- Hacer commit tras cada tarea o grupo lógico, siempre en la rama `005-caja-reportes`.

## Ajustes durante la implementación

- La migración pasó a `20261029000004_billing` (la 004 ya usa `…000003_kitchen`) y se regeneró
  contra el schema con los modelos de cocina. El índice `orders(status, closed_at)` también se
  declara en `schema.prisma` (`@@index([status, closedAt])`) para que `prisma migrate dev` no
  detecte deriva.
- `simulateCashierPayment` se eliminó de `order-factories.ts`: las pruebas de la 003
  (`orders-tables` y `orders-realtime`, AC-6.6) cobran con `POST /api/billing/accounts/:id/payments`.
- `CashierHome` y `RoleHome` (sustitutos de la 001) se eliminaron: `/caja` es `PendingAccountsPage`.
- El pago reintenta con la misma `Idempotency-Key` antes de bloquear el pedido: el reintento del
  pago que completó la cuenta (pedido ya `PAID`) devuelve el mismo resultado en vez de `ORDER_NOT_OPEN`.
- Con una división desactualizada se rechaza cualquier pago (`SPLIT_STALE`), no solo el de una
  parte, igual que `canCharge`. Una división por ítems cuyos montos no suman el saldo (hubo pagos
  sin partes) se rechaza con `SPLIT_INVALID_ASSIGNMENT`; en ese caso se divide en partes iguales.
- La clave de idempotencia del cobro usa `uuidV4` de `orders/pending-dispatch.ts` (ahora exportado):
  `crypto.randomUUID` no existe al abrir la demo por `http://` desde la tablet.
- `tests/render.tsx` suma `renderNavigableRoutes` (router declarativo): en jsdom, la navegación
  del router de datos falla al crear su `Request`, y las pantallas de caja navegan solas.
- `seed-e2e.ts` borra también pagos y divisiones de los pedidos de prueba; `billing.spec.ts` la
  ejecuta antes del cierre del día (`e2e/helpers/seed.ts`) porque el cierre exige todas las mesas libres.
- La prueba de rendimiento ejecuta `ANALYZE` tras la carga masiva: sin estadísticas al día el
  planificador elige un plan de segundos en vez de milisegundos.
- Resultado de T058 (2026-11-01): typecheck, lint y `check:ac -- 001 002 003 004 005` en verde
  (30/30 de la 005); `npm test` en verde con Node 22 (el del CI): API 218/218, web 79/79 (con
  Node 24, dos pruebas de navegación de la 001 fallan por el `AbortSignal` de jsdom). En
  `test:e2e`, las 12 pruebas de la 005 pasan en ambos tamaños de tablet; fallan 7 de la 001 y la
  003 cuyo código no cambia respecto de `main`: `login` AC-1.1 y AC-1.5 (buscan el saludo
  "Hola, …" que ya no muestra `/mozo`) y `waiter` AC-3.8 y AC-3.9 (envío sin conexión).
- T059 (recorrido manual en tablet) queda pendiente: lo hace una persona con la tablet.
