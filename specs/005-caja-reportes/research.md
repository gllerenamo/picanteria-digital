# Research: Caja y reportes

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-29

Cada decisión sigue el formato Decisión / Razón / Alternativas consideradas. El stack es el del
monorepo ([001 research](../001-base-comun/research.md)); aquí solo se documenta lo nuevo de Caja.

## 1. Un módulo `billing` que reutiliza el modelo de la 003

- **Decisión**: un módulo NestJS `billing` (`apps/api/src/billing`) con tres controladores:
  `accounts` (cuenta, división, pagos), `closures` (cierre del día) y `reports` (reportes). No
  copia datos del pedido: lee `Order`, `OrderItem`, `ItemVoid` y `DiningTable` de la 003 y
  reutiliza sus funciones puras de `apps/api/src/orders/order-mapper.ts` (`consumptionCents`,
  `toCents`, `money`, `toOrderItem`) y el bloqueo `lockOpenOrder` de `order-locks.ts`.
- **Razón**: la cuenta **es** el consumo del pedido (003 FR-035); calcularla con las mismas
  funciones garantiza que mozo y cajero vean el mismo total (SC-005). Reutilizar el bloqueo de
  fila serializa el cobro con las acciones del mozo sobre el mismo pedido (agregar ítems a una
  mesa por cobrar, 003 FR-034).
- **Alternativas consideradas**: una tabla `Bill` con copia de los ítems al pedir la cuenta
  (duplica datos y se desincroniza si la mesa vuelve a ocupada); módulo `reports` separado
  (los reportes solo leen datos de Caja; un módulo aparte no aporta nada en esta feature).

## 2. La cuenta no es una tabla: se calcula

- **Decisión**: no hay entidad "Cuenta". Total = `consumptionCents` de los ítems del pedido;
  pagado = suma de `Payment` vigentes del pedido; saldo = total − pagado. El estado "pagada" es
  `Order.status = PAID` (definido por la 003 para que lo fije Caja).
- **Razón**: evita estados duplicados. El total puede cambiar mientras la mesa está abierta
  (agregados o anulaciones), y calcularlo siempre da el valor vigente.
- **Alternativas consideradas**: guardar el total al pedir la cuenta (queda obsoleto si se
  agrega algo, AC-2.6).

## 3. Dinero en céntimos

- **Decisión**: columnas `Decimal(10,2)` en la base; en el código, enteros en céntimos con
  `toCents` y respuestas con el esquema `Money` de la 003 (`{ amount, formatted: "S/ 0.00" }`).
- **Razón**: sin errores de coma flotante al sumar pagos o repartir en partes (SC-004, SC-005).
  Coherente con la 003.

## 4. Pagos

- **Decisión**: entidad `Payment` con `method` (`CASH`, `YAPE_PLIN`, `CARD`), `amount` (lo que se
  aplica a la cuenta), `receivedAmount` y `changeAmount` (solo efectivo), `reference` opcional
  (Yape/Plin y tarjeta), `cashierId`, `paidAt`, `partId` opcional y estado `VALID | VOIDED`
  con `voidReason`, `voidedById`, `voidedAt`. El alta de pagos usa la cabecera
  `Idempotency-Key` con el mismo decorador de la 003 (`apps/api/src/orders/idempotency-key.decorator.ts`)
  y su código `IDEMPOTENCY_KEY_REUSED`: reintentar un cobro con la misma clave devuelve el
  resultado anterior sin duplicar el pago.
- **Reglas**: `amount ≤ saldo`; en efectivo `receivedAmount ≥ amount`; solo con la mesa
  `POR_COBRAR`; anular solo mientras el pedido siga `OPEN` (FR-014).
- **Razón**: un doble toque o un reintento por mala conexión no puede cobrar dos veces (caso
  borde de pérdida de conexión). Guardar los pagos anulados permite auditarlos.
- **Alternativas consideradas**: borrar pagos anulados (se pierde la traza); un solo pago por
  cuenta (no permite dividir).

## 5. Cobro y liberación de la mesa en una transacción

- **Decisión**: registrar un pago ocurre en una transacción que (1) bloquea el pedido con
  `lockOpenOrder`, (2) verifica que la mesa esté `POR_COBRAR` y que el monto no supere el saldo,
  (3) inserta el pago y, si el saldo llega a cero, (4) pasa el pedido a `PAID` con `closedAt` y
  la mesa a `LIBRE` con `TablesService.transition(tx, tableId, ['POR_COBRAR'], 'LIBRE')`, la
  misma función con la que la 003 hace sus transiciones de mesa (módulo `menu`). Tras confirmar, emite `orders:table-status-changed` (mesa libre) a mozos y
  cajeros y `billing:account-updated` a cajeros.
- **Razón**: dos cajeros sobre la misma mesa (caso borde) o un mozo que agrega algo mientras se
  cobra quedan serializados por el bloqueo de fila; el segundo ve el saldo actualizado.
- **Alternativas consideradas**: transacción serializable con reintentos (más compleja; el
  bloqueo de fila ya usado por la 003 basta).

## 6. División de la cuenta

- **Decisión**: entidades `BillSplit` (modo `EQUAL` o `BY_ITEMS`, saldo base al dividir,
  `supersededAt`), `BillPart` (etiqueta, monto) y `BillPartItem` (ítem y unidades asignadas, solo
  en `BY_ITEMS`). Un pedido tiene como máximo una división vigente (índice único parcial
  `WHERE superseded_at IS NULL`). Dividir de nuevo marca la anterior como reemplazada y reparte
  el **saldo pendiente**; los pagos ya hechos se conservan (FR-013).
  - `EQUAL`: monto = ⌊saldo / n⌋ céntimos; los céntimos sobrantes van a la parte 1 (caso borde).
  - `BY_ITEMS`: monto de la parte = Σ unidades asignadas × precio unitario; deben asignarse
    todas las unidades vigentes no pagadas; ninguna puede asignarse dos veces.
- **División desactualizada**: si el total cambió después de dividir (agregados o anulaciones),
  la división queda marcada `isStale` y el cajero debe volver a dividir el saldo antes de cobrar
  una parte. En `BY_ITEMS`, la nueva división parte de las asignaciones anteriores y muestra
  sin asignar solo las unidades nuevas (caso borde "ítems agregados después de dividir").
- **Razón**: modela ambas formas pedidas (Clarification Q1) sin calcular montos al vuelo sobre
  datos que pueden cambiar.
- **Alternativas consideradas**: montos libres escritos a mano (no garantiza que la suma sea el
  total); recalcular partes automáticamente al agregar ítems (confunde al cliente que ya sabe
  cuánto le toca).

## 7. Cierre del día

- **Decisión**: entidad `DayClosure` con `startedAt` (fin del cierre anterior o primer pago),
  `closedAt`, `cashierId`, por método `expected` y `counted` (la diferencia se deriva y también
  se guarda), `accountsCount`, `total` y `notes`. Al confirmar, todos los pagos con
  `closureId` nulo pasan a pertenecer al cierre (`closureId` = el nuevo cierre).
  - Conteo a ciegas: `POST /billing/closures/preview` exige los montos contados y recién
    entonces devuelve lo registrado y las diferencias; `POST /billing/closures` lo guarda.
  - Se rechaza si hay pedidos `OPEN` (mesas ocupadas o por cobrar), según Clarification Q2.
  - Un bloqueo de asesoría (`pg_advisory_xact_lock(5005)`) evita dos cierres simultáneos.
- **Razón**: asignar los pagos al cierre por `closureId` (y no por rango de horas) hace que los
  cobros posteriores pertenezcan a la siguiente jornada (AC-3.4) y que la jornada pueda pasar
  de medianoche. Como el cierre exige todas las mesas libres, todo pago sin cierre pertenece a
  una cuenta ya pagada.
- **Alternativas consideradas**: cierre por fecha de calendario (falla con jornadas después de
  medianoche); pantalla que muestra lo esperado antes de contar (sesga el conteo).

## 8. Reportes

- **Decisión**: consultas de agregación en SQL (`$queryRaw` tipado) sobre pedidos `PAID` con
  `closedAt` en el rango y sus pagos vigentes:
  - Ventas: total, cuentas (pedidos pagados con al menos un pago vigente), ticket promedio, total
    por día (`closedAt AT TIME ZONE 'America/Lima'`) y por método.
  - Platos más vendidos: `OrderItem` de esos pedidos con estado distinto de `DRAFT` y `VOIDED`,
    unidades = `quantity − voidedQuantity`, monto = unidades × `unitPrice`, agrupado por plato y
    ordenado por unidades o por monto (AC-5.4).
  - Rango por fechas `from`–`to` (inclusive, zona de Perú), máximo 366 días.
  - Índices nuevos: `payments(order_id, status)`, `payments(closure_id)` y
    `orders(status, closed_at)` para que un año de datos responda en menos de 3 s (SC-007).
- **Razón**: las cuentas cerradas sin cobro no tienen pagos y quedan fuera (FR-024); agrupar en
  la base escala mejor que traer todas las filas a Node.
- **Alternativas consideradas**: tablas de resumen precalculadas al cerrar (innecesarias a la
  escala de un local).

## 9. Tiempo real

- **Decisión**: Caja escucha `orders:table-status-changed` (de la 003) para mantener la lista de
  mesas por cobrar y bloquear el cobro si una mesa vuelve a ocupada (AC-1.7), y emite el mismo
  evento con `status: 'LIBRE'` al cobrar. Nuevo evento `billing:account-updated` a la sala
  `role:CASHIER` cuando cambian pagos o división, para que dos cajeros vean el mismo saldo.
- **Razón**: reutiliza el canal y las salas existentes; la vista de mozo de la 003 ya reacciona
  al cambio de estado de mesa (003 AC-6.6).

## 10. Interfaz y pruebas

- **Decisión**: pantallas `/caja` (mesas por cobrar), `/caja/cuentas/:orderId` (cuenta, división
  y pagos), `/caja/cierre` y `/caja/cierres` para el cajero; `/admin/reportes` (ventas y platos)
  solo para el administrador, registrada en `APP_ROUTES`. Pruebas con el prefijo `[005]`; las de
  aceptación de la API preparan pedidos cobrables directamente en la base de pruebas
  (`createBillableOrder`); las e2e usan el flujo real de la 003 (tomar, enviar y pedir la
  cuenta), ya disponible en `main`.
- **Razón**: las pruebas de la API fijan casos exactos (anulaciones parciales, precios) sin
  depender de las pruebas aún pendientes de la 003; las e2e validan la integración real.

## Dependencias nuevas

Ninguna. Caja usa solo las bibliotecas ya justificadas en la 001.
