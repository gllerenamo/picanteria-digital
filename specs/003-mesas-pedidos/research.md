# Research: Mesas y pedidos (Módulo 2)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-29

Esta feature reutiliza el stack y las convenciones de `001-base-comun`
([research.md](../001-base-comun/research.md)): monorepo con npm workspaces, NestJS 11 +
Prisma 6 + PostgreSQL 17, React 19 + Vite + TanStack Query + Tailwind, Socket.IO con salas
`user:<id>` y `role:<ROL>`, Jest + Supertest contra PostgreSQL real, Vitest + Testing Library +
MSW y Playwright en viewports de tablet. Aquí solo se documentan las decisiones propias de
mesas y pedidos y las que acordamos con `004-cocina`
([dependencias-003.md](../004-cocina/contracts/dependencias-003.md) en la rama `004-cocina`).

En `main`, `specs/004-cocina/` solo tiene `spec.md` y `checklists/`. Los enlaces de este plan a
otros archivos de la 004 (plan, research, data-model, contratos) apuntan a la rama
`004-cocina` y funcionarán cuando se integre.

**No se agregan dependencias nuevas.**

## 1. Módulo `orders` y propiedad de los datos

- **Decisión**: un módulo `orders` en `apps/api/src/orders/` es dueño de `Order`, `OrderItem`,
  `KitchenDispatch` e `ItemVoid` y de las reglas de pedido: abrir, tomar, enviar, anular, pedir
  la cuenta y cancelar la apertura. `DiningTable` y `MenuItem` siguen en el módulo `menu` de la
  002; la 003 los lee y cambia `DiningTable.status` solo a través de `menu` (§2). Cocina (004)
  lee las entidades de la 003 y cambia solo `OrderItem.status`
  ([004 research §1](../004-cocina/research.md)).
- **Razón**: una sola fuente de verdad para el ítem, el envío y la anulación. Pedidos, cocina y
  caja ven los mismos estados. Los nombres de campos y estados son los acordados con cocina.
- **Alternativas consideradas**: copiar el envío a una tabla de cocina (duplica datos y obliga
  a sincronizar anulaciones); mover `DiningTable` al módulo `orders`, como sugería el modelo
  general de la 001 (rompe la 002 ya integrada; ver §17).

## 2. Cómo escribe la 003 en `DiningTable.status`

- **Decisión**: `TablesService` (módulo `menu`, ya exportado por `MenuModule`) gana un método
  `transition(tx, tableId, from, to)`. Recibe el cliente de la transacción de Prisma
  (`Prisma.TransactionClient`), hace una actualización condicionada
  (`updateMany({ where: { id, status: { in: from } }, data: { status: to } })`) y devuelve si
  cambió exactamente una fila. `OrdersModule` importa `MenuModule` y llama a ese método
  **dentro de su propia transacción**, junto con el cambio del pedido. Si no cambió ninguna
  fila, el servicio de pedidos responde `409` con el estado actual. Caja (005) usará el mismo
  método para pasar `POR_COBRAR → LIBRE` al cobrar.

  | Acción (003) | `from` | `to` |
  |--------------|--------|------|
  | Abrir la mesa | `LIBRE` | `OCUPADA` |
  | Pedir la cuenta | `OCUPADA` | `POR_COBRAR` |
  | Agregar algo a una mesa por cobrar (con confirmación) | `POR_COBRAR` | `OCUPADA` |
  | Cancelar la apertura | `OCUPADA` | `LIBRE` |
  | Cobrar (Caja, 005) | `POR_COBRAR` | `LIBRE` |

- **Razón**: el cambio de estado de la mesa se confirma en la misma transacción que el pedido
  (no puede quedar una mesa `OCUPADA` sin pedido ni un pedido sin su mesa ocupada), la
  condición sobre el estado esperado resuelve las carreras sin bloqueos explícitos, igual que
  la 004 ([004 research §2](../004-cocina/research.md)), y hay un solo punto de entrada que
  respeta que la mesa vive en `menu`.
- **Alternativas consideradas**: que `orders` escriba directo con `tx.diningTable.update`
  (atómico, pero cada feature repetiría la regla y Caja tendría otra copia); un endpoint HTTP de
  `menu` para cambiar el estado (no puede participar en la transacción del pedido); un evento
  interno entre módulos (dependencia nueva y sin atomicidad).

## 3. Concurrencia: una sola orden `OPEN` por mesa (FR-003, AC-1.5, SC-008)

- **Decisión**: dos barreras en la misma transacción.
  1. `TablesService.transition(tx, tableId, ['LIBRE'], 'OCUPADA')`. De dos peticiones
     simultáneas, solo una cambia la fila; la otra espera el bloqueo de fila de PostgreSQL, ve
     la mesa `OCUPADA` y no actualiza nada.
  2. Índice único parcial `orders_one_open_per_table` sobre `orders (table_id) WHERE status =
     'OPEN'`, creado con SQL en la migración porque Prisma no declara índices parciales (la 004
     hizo lo mismo con `ready_notices_open_item`). Es la invariante en la base aunque alguien
     salte la primera barrera.
  El perdedor recibe `409 TABLE_NOT_AVAILABLE` con `details: { status, openedBy }` y el mensaje
  "La mesa ya la abrió {nombre}", usando el `message` de `AppException` como hace
  `menu.service.ts`. Un `P2002` del índice se convierte en la misma respuesta.
- **Razón**: la primera barrera da el mensaje correcto sin excepciones de la base; la segunda
  garantiza la invariante. La prueba lanza dos aperturas con `Promise.all` y comprueba que
  queda una sola orden `OPEN`.
- **Alternativas consideradas**: solo el índice único (funciona, pero la mesa podría quedar con
  un estado incoherente si otra ruta la modifica); `SERIALIZABLE` con reintentos (más complejo
  para el mismo resultado).

## 4. Concurrencia: `sequence` correlativo, único y en orden de confirmación (SC-002, FR-018)

- **Decisión**: el envío se crea bajo un bloqueo de asesoría de transacción global
  (`SELECT pg_advisory_xact_lock(3003)` como primera sentencia). Con el bloqueo tomado:
  `sequence = COALESCE(MAX(sequence), 0) + 1` sobre `kitchen_dispatches` y
  `round = COUNT(*) + 1` sobre los envíos de esa orden. `sequence` tiene índice único y
  `(order_id, round)` también, como respaldo.
- **Razón**: el bloqueo se libera al confirmar, así que el orden de `sequence` es exactamente el
  orden de confirmación, sin huecos, que es lo que pide "en el orden en que se confirmaron" y lo
  que usa la 004 para ordenar el tablero. Con 5 mozos y unos 60 envíos por servicio,
  serializar la creación de envíos no se nota.
- **Alternativas consideradas**: una secuencia de PostgreSQL o `@default(autoincrement())`
  (único, pero dos transacciones pueden confirmar en orden inverso al número que tomaron y un
  rollback deja huecos); una fila contador con `SELECT … FOR UPDATE` (mismo resultado que el
  bloqueo de asesoría, con una tabla más).

## 5. Idempotencia del envío (FR-022, AC-3.9, SC-001)

- **Decisión (servidor)**: `POST /api/orders/{orderId}/dispatches` exige la cabecera
  `Idempotency-Key` (UUID; sin ella, `400 VALIDATION_ERROR`). `KitchenDispatch.idempotencyKey` es
  única. Dentro de la transacción y con el bloqueo del §4 tomado, primero se busca la clave:
  - si existe para el mismo pedido, se devuelve ese envío con `201`, sin crear nada ni emitir
    eventos de nuevo;
  - si existe para otro pedido, `409 IDEMPOTENCY_KEY_REUSED`;
  - si no existe, se crea el envío.
  Un `P2002` sobre la clave (no debería ocurrir con el bloqueo) se resuelve releyendo y
  devolviendo el envío guardado.
- **Decisión (cliente)**: la clave se genera cuando el mozo toca "Enviar a cocina" y se guarda
  por pedido en `sessionStorage` (`pending-dispatch.ts`) hasta recibir una respuesta definitiva:
  `201`, o un `409` (`NOTHING_TO_SEND`, `ITEMS_UNAVAILABLE`, `ORDER_NOT_OPEN`). Ante
  `NETWORK_ERROR` o un `5xx` se conserva y el botón "Reintentar" la reutiliza, también después
  de recargar la página. Se genera con `crypto.getRandomValues` (formato UUID v4), porque
  `crypto.randomUUID` no existe en contextos no seguros y la demo se abre por `http://` desde la
  tablet en la red local.
- **Cambio en la 001**: `request()` de `apps/web/src/lib/api-client.ts` no acepta cabeceras
  extra; se le agrega un parámetro opcional `headers`, sin cambiar las llamadas existentes.
- **Razón**: el caso de la spec es el corte de conexión durante el envío: la petición pudo
  llegar o no. Con la misma clave, el reintento devuelve lo ya registrado o lo registra por
  primera vez, nunca dos veces.
- **Alternativas consideradas**: deduplicar por contenido (dos rondas iguales legítimas se
  confundirían); desactivar el botón tras el primer toque (no cubre el corte de red).

## 6. Bloqueo por pedido para las demás operaciones

- **Decisión**: toda operación que modifica un pedido (agregar, editar o quitar un ítem,
  enviar, pedir la cuenta, cancelar la apertura, cambiar comensales) empieza su transacción con
  `SELECT … FROM orders WHERE id = $1 FOR UPDATE` (ayudante `lockOpenOrder`), que además
  comprueba `status = 'OPEN'` (si no, `409 ORDER_NOT_OPEN`). El envío toma primero el bloqueo
  global del §4 y luego el del pedido; las demás solo el del pedido. Ese orden fijo evita
  bloqueos mutuos.
- **Razón**: dos mozos pueden atender la misma mesa (Clarifications, FR-005). El bloqueo
  serializa sus cambios sobre el mismo pedido: un envío toma los borradores que existían al
  bloquear (`SELECT … WHERE status = 'DRAFT' FOR UPDATE`) y un "quitar" simultáneo espera o
  falla con `409 ITEM_ALREADY_SENT`. Así se cumple el caso borde "el envío lleva todos los no
  enviados una sola vez", y cancelar o pedir la cuenta no se cruzan con un envío en curso.
- **Alternativas consideradas**: control optimista con versión del pedido (más reintentos en el
  cliente para el mismo resultado).

## 7. Anulación concurrente con el "Listo" de cocina (FR-029 a FR-032)

- **Decisión**: la anulación se aplica con una sola actualización condicionada en SQL
  (`$queryRaw`), porque Prisma no compara columnas entre sí en un `where`:

  `UPDATE order_items SET voided_quantity = voided_quantity + $units, status = CASE WHEN
  voided_quantity + $units = quantity THEN 'VOIDED' ELSE status END WHERE id = $id AND status IN
  ('PENDING', 'PREPARING') AND quantity - voided_quantity >= $units RETURNING …`

  En la misma transacción se inserta la fila de `ItemVoid`. Si no se actualizó nada, se relee el
  ítem y se responde `409 ITEM_NOT_VOIDABLE` con
  `details.reason` = `READY` | `VOIDED` | `NOT_SENT` | `NOT_ENOUGH_UNITS` y
  `details.remainingQuantity`. Con `READY`, el mensaje explica que "El plato ya está listo; no
  se puede anular" (AC-5.4).
- **Razón**: es el mismo estilo que usa la 004 para avanzar estados (`UPDATE … WHERE status =
  $from`). Entre "Listo" y una anulación simultáneas gana la primera que confirma, y la otra ve
  el estado nuevo. Una anulación parcial no cambia el estado (acordado con la 004).
- **Alternativas consideradas**: `SELECT … FOR UPDATE` y luego validar en TypeScript (más código
  para el mismo resultado).

## 8. Precio y estados del ítem

- **Decisión**: `OrderItem.unitPrice` es nulo mientras el ítem está en `DRAFT`; al enviarse se
  copia `MenuItem.price` en la misma sentencia que fija `dispatchId` y pasa el ítem a `PENDING`
  (FR-025). Mientras es borrador, la API muestra el precio actual de la carta (`currentPrice`)
  y si sigue disponible (`isAvailable`). Un plato está disponible si `isAvailable` e `isActive`
  son verdaderos. La disponibilidad se comprueba al agregar (`409 MENU_ITEM_UNAVAILABLE`) y otra
  vez al enviar (`409 ITEMS_UNAVAILABLE` con la lista, sin enviar nada, FR-020). Restricciones
  `CHECK` en la migración: `quantity >= 1`, `0 <= voided_quantity <= quantity` y
  `(status = 'DRAFT') = (dispatch_id IS NULL)`.
- **Razón**: el precio cobrado es el del momento del envío. Las restricciones hacen imposible
  un ítem enviado sin envío o con más anulaciones que unidades, aunque falle una validación.
- **Alternativas consideradas**: fijar el precio al agregar el borrador (la spec dice al enviar);
  guardar el precio en el envío y no en el ítem (cocina y caja lo leen por ítem).

## 9. Eventos después del commit y un solo ayudante de emisión

- **Decisión**: los servicios emiten después de que `prisma.$transaction` termina con éxito, y
  nunca dentro. Para emitir a salas de rol se usa el ayudante `emitToRoles(roles, evento, carga)`
  que la 004 agrega a `RealtimeGateway` ([004 plan](../004-cocina/plan.md)), con el mismo
  nombre y firma. La feature que se integre primero lo crea y la otra lo reutiliza. No se crea
  otro gateway. Eventos de la 003 ([contracts/websocket-events.md](contracts/websocket-events.md)):
  `orders:dispatch-sent` y `orders:item-voided` a `role:KITCHEN` y `role:WAITER`, y
  `orders:table-status-changed` a `role:WAITER` y `role:CASHIER`.
- **Razón**: un evento emitido antes del commit haría que el cliente consulte y no encuentre el
  cambio. No hace falta una tabla de salida (outbox): si el proceso cae entre el commit y la
  emisión, el servidor de Socket.IO cae con él, todos los clientes se reconectan y, por la regla
  de la 001 y la 004, vuelven a pedir el estado completo. El evento es una mejora; la consulta
  es la garantía.
- **Alternativas consideradas**: outbox con un proceso que reenvía (complejidad sin beneficio a
  esta escala); un método de dominio por evento en el gateway (la 004 ya eligió el ayudante
  genérico).

## 10. Lo que no tiene evento: disponibilidad y borradores de otro mozo

- **Decisión**: la pantalla del pedido usa `refetchOnWindowFocus` y `refetchInterval` de
  **15 s** mientras está abierta. La vista de mesas se actualiza con los eventos.
- **Razón**: la 002 no emite eventos al cambiar la disponibilidad (`events.ts` solo tiene
  `auth:*`), y los borradores que agrega otro mozo en la misma mesa no generan ninguno de los
  tres eventos acordados. La spec pide que un plato agotado se vea marcado antes de enviar y que
  ambos mozos vean los borradores, sin fijar un tiempo; 15 s lo cumple sin tocar la 002. La
  garantía fuerte está en el servidor: al enviar se vuelve a comprobar la disponibilidad
  (FR-020) y el envío toma todos los borradores una sola vez (§6).
- **Alternativas consideradas**: un evento `orders:draft-changed` solo para mozos (fuera de lo
  acordado y con poco valor); pedir a la 002 un evento `menu:availability-changed` (posible
  mejora futura; anotado en §17).

## 11. Cliente: el evento avisa, la consulta manda

- **Decisión**: igual que la 004 ([004 research §6 y §7](../004-cocina/research.md)). La vista
  del mozo guarda `['orders', 'tables']` y `['orders', orderId]` en TanStack Query. Ante
  `orders:dispatch-sent`, `orders:item-voided`, `orders:table-status-changed` o
  `kitchen:item-status-changed` (de la 004), y al reconectarse el socket, invalida `['orders']`
  y vuelve a pedir. Se suscribe con `useRealtimeEvent` sobre el socket compartido de
  `RealtimeProvider` (`apps/web/src/lib/realtime-context.tsx`, el que plantea la 004), sin abrir
  otra conexión.
- **Razón**: sin lógica de fusión no hay duplicados ni estados perdidos tras un corte (FR-038).
  Los retrocesos por "Deshacer" de cocina se ven igual (004 E3).
- **Coordinación**: `RealtimeProvider`/`useRealtimeEvent` y la constante de
  `kitchen:item-status-changed` en `events.ts` los crea la 004. Si la 003 se integra antes, los
  crea con esos mismos nombres y la 004 los reutiliza.

## 12. Sin conexión (FR-037, FR-038, AC-3.8)

- **Decisión**: un `ConnectionBanner` visible en las pantallas del mozo cuando el socket está
  desconectado o `navigator.onLine` es falso: "Sin conexión. Lo enviado está a salvo; para
  enviar a cocina necesitas conexión." No hay cola local de cambios: mientras no hay conexión
  se muestra lo último que se cargó, y agregar o enviar falla con el mensaje
  `NETWORK_ERROR` de la 001. Los borradores ya guardados viven en el servidor (FR-013).
  Componente compartido en `apps/web/src/components/ConnectionBanner.tsx`; la 004 plantea uno
  en `features/kitchen/`: se propone usar uno solo.
- **Razón**: la spec no exige trabajar sin conexión (Assumptions). Lo que exige es no perder lo
  tomado ni lo enviado y que el mozo sepa qué salió, y eso lo cubren el servidor (§5, §6) y el
  indicador.
- **Alternativas consideradas**: cola de operaciones en IndexedDB con reenvío (conflictos con
  otros mozos y con cocina; fuera de alcance).

## 13. Pantallas del mozo y del administrador

- **Decisión**: `/mozo` muestra el tablero de mesas (`TablesBoardPage`, reemplaza el
  `WaiterHome` provisional de la 001) y `/mozo/pedidos/:orderId` muestra el pedido
  (`OrderPage`). `appRouteFor` ya trata `/mozo/...` como `/mozo`, así que `APP_ROUTES` no
  cambia. El administrador entra a las mismas pantallas (FR-011 de la 001) y, solo para él, cada
  ítem enviado anulable muestra "Anular" (FR-028). No hay pantalla de anulación aparte. La carta
  disponible se lee con `GET /api/menu/tree?availableOnly=true` de la 002.
- **Razón**: el administrador necesita ubicar la mesa y el ítem, que es justo lo que muestra la
  vista del mozo. Un solo recorrido para probar en tablet.
- **Alternativas consideradas**: una pantalla `/admin/anulaciones` (duplica el tablero).

## 14. Mesa por cobrar: volver a ocupada al agregar (FR-034, AC-6.7)

- **Decisión**: `POST /api/orders/{orderId}/items` sobre una mesa `POR_COBRAR` responde
  `409 TABLE_AWAITING_PAYMENT` si el cuerpo no trae `confirmReopen: true`. La pantalla muestra
  la confirmación ("La mesa está por cobrar. ¿Volver a abrirla para agregar?") y repite la
  petición con `confirmReopen: true`, que en una transacción agrega el ítem y pasa la mesa a
  `OCUPADA`.
- **Razón**: la confirmación queda garantizada por el servidor (Principio IV) y el cambio de
  estado es atómico con el ítem. No hay un endpoint "reabrir" que deje la mesa ocupada sin
  agregar nada.

## 15. Cancelar la apertura (FR-006, AC-1.6, AC-1.8)

- **Decisión**: `POST /api/orders/{orderId}/cancel`. Lo puede hacer el mozo responsable
  (`Order.waiterId`) o un administrador (FR-011 de la 001); otro mozo recibe `403 FORBIDDEN` con
  el mensaje "Solo el mozo que abrió la mesa puede cancelar la apertura". Si el pedido tiene algún
  envío, `409 CANCEL_NOT_ALLOWED`. Si no, el pedido pasa a `CANCELLED` (con sus borradores,
  que no se borran) y la mesa a `LIBRE`.

## 16. Estrategia de pruebas

- **Decisión**: igual que la 001. Títulos `"[003] AC-x.y: …"` y `npm run check:ac -- 003`. Las
  carreras se prueban contra PostgreSQL real con `Promise.all` (dos aperturas, dos envíos de
  mesas distintas, el mismo envío dos veces con la misma clave, anulación contra "Listo"). Los
  eventos se prueban con `socket.io-client`, como `realtime.acceptance.spec.ts` de la 001,
  midiendo que lleguen en menos de 3 s (SC-003, SC-004). `resetDb` borra primero las tablas de
  la 003 (orden de claves foráneas).
- **Avisos de plato listo**: son criterios de la 004 (AC-3.1, AC-3.3 y AC-3.5), no de la 003
  (decisión tomada tras `/speckit-analyze` el 2026-10-29). Así la 003 no depende de que la 004
  esté en `main` para cumplir la puerta del Principio II, y la 004 puede empezar sobre la
  migración de la 003 sin un bloqueo mutuo. `check:ac -- 003` debe dar 41/41 y la 003 entra al
  CI desde su propio PR.
- **Cobro de Caja (AC-6.6)**: mientras no exista la 005, el ayudante de prueba
  `simulateCashierPayment` hace lo que hará Caja: pasa la mesa a `LIBRE` con
  `TablesService.transition`, deja el pedido `PAID` y emite `orders:table-status-changed`. Las
  pruebas comprueban los datos y el evento; cuando la 005 exista, su prueba de cobro reemplaza
  a este sustituto.

## 17. Desajustes encontrados y decisiones pendientes

Ningún punto del texto de entrada del plan choca con el código que hoy está en `main`. Lo que
sigue son desajustes entre documentos o dependencias con otras features. Ninguno se resolvió
aquí:

| # | Hallazgo | Tipo | Quién lo resuelve |
|---|----------|------|-------------------|
| P1 | El modelo general de la 001 ([data-model.md](../001-base-comun/data-model.md)) asigna `DINING_TABLE` al módulo `orders` y a la 003; el código de la 002 la puso en `menu`, y este plan sigue al código. | Documento de la 001 vs. código | Dueño de la 001 (actualizar la tabla de correspondencia) |
| P2 | La 001 reservó `orders:created` y `orders:updated`; el contrato de la 004 y el diagrama de su plan todavía los usan. Los nombres acordados son `orders:dispatch-sent` y `orders:item-voided` (la propia 004 dice que la 003 fija los nombres). | Documentos de la 001 y de la 004 | Dueños de la 001 y de la 004 |
| P3 | El data-model de la 004 (§4) lee `DiningTable.number`; la columna es `tableNumber`. | Documento de la 004 vs. código | Dueño de la 004 |
| P4 | `dependencias-003.md` (A2) cita `003 US4-AS3`, que ya no existe: el aviso en cualquier pantalla es FR-027 de la 003 y lo prueba la 004 con su AC-3.1. | Documento de la 004 | Dueño de la 004 |
| P5 | FR-036 (al cobrar, los mozos ven la mesa libre sin recargar) necesita que Caja llame a `TablesService.transition` y emita `orders:table-status-changed`. La prueba sustituta de AC-6.6 (`simulateCashierPayment`, §16) fija ese contrato; la prueba de cobro de la 005 la reemplaza. | Dependencia con la 005 | Dueño de la 005 |
| P6 | `emitToRoles`, `RealtimeProvider`/`useRealtimeEvent`, `ConnectionBanner` y la constante de `kitchen:item-status-changed` los plantea la 004. Si la 003 se integra antes, los crea con esos nombres. | Coordinación con la 004 | 003 y 004 |
| P7 | La 002 no emite un evento cuando cambia la disponibilidad; la 003 lo cubre consultando cada 15 s (§10). | Posible mejora en la 002 | Dueño de la 002 (opcional) |
| P8 | Los avisos de plato listo pasaron a ser criterios de la 004 (§16). Su prueba de AC-3.1 (`apps/web/e2e/kitchen.spec.ts`) muestra el aviso en `/mozo`; para cubrir el "en cualquier pantalla" de FR-027 debería mostrarlo también en otra pantalla, por ejemplo `/mozo/pedidos/:orderId`. | Coordinación con la 004 | Dueño de la 004, a pedido de la 003 (T045) |

## Resumen de dependencias nuevas

Ninguna. Se modifican, sin cambiar su comportamiento actual: `TablesService` (método
`transition`), `RealtimeGateway` (ayudante de emisión, si la 004 no lo agregó antes),
`api-client.ts` (cabeceras opcionales), `resetDb` de las pruebas y los modelos `User`,
`DiningTable` y `MenuItem` de `schema.prisma` (solo campos de relación inversa; ninguna
columna nueva).
