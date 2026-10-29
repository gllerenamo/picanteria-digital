# Research: Módulo Cocina — pantalla de comandas

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-29

Esta feature reutiliza el stack y las convenciones fijadas en `001-base-comun`
([research.md](../001-base-comun/research.md)): monorepo con npm workspaces, NestJS 11 +
Prisma 6 + PostgreSQL 17, React 19 + Vite + TanStack Query + Tailwind, Socket.IO con salas
`user:<id>` y `role:<ROL>`, Jest + Supertest, Vitest + Testing Library + MSW y Playwright en
viewports de tablet. Aquí solo se documentan las decisiones propias de la cocina.

**No se agregan dependencias nuevas.**

## 1. Propiedad de los datos entre Pedidos y Cocina

- **Decisión**: el envío a cocina, el ítem del pedido, su estado y sus anulaciones pertenecen a
  `003-mesas-pedidos` (módulo `orders`). Cocina no crea tablas paralelas: lee esas entidades y
  cambia solo el campo de estado del ítem (`Pendiente → En preparación → Listo` y los
  retrocesos de "Deshacer"). Las tablas propias de cocina guardan lo que solo le importa a
  ella: el historial de cambios de estado, los avisos de plato listo y la confirmación de
  anulaciones ([data-model.md](data-model.md)).
- **Razón**: una sola fuente de verdad para el ítem evita que pedidos, cocina y caja vean
  estados distintos. Coincide con la tabla de propiedad del modelo general de la 001, donde
  `kitchen` "opera sobre el estado de los ítems".
- **Alternativas consideradas**: una tabla `kitchen_tickets` copiada desde cada envío (duplica
  datos y obliga a sincronizar anulaciones y precios); que `orders` exponga un servicio para
  cambiar estados (acopla `orders` a reglas que son de cocina).

## 2. Cambios de estado concurrentes

- **Decisión**: cada acción de cocina envía el estado que el usuario vio (`from`). El servicio
  actualiza con una condición sobre ese estado (`UPDATE … WHERE id = $1 AND status = $from`) y
  registra el cambio en la misma transacción. Si no se actualizó ninguna fila, responde
  `409 ITEM_STATE_CONFLICT` con el estado actual. Un ítem anulado responde `409 ITEM_VOIDED`.
- **Razón**: cubre el caso borde de dos pantallas que tocan el mismo ítem (se aplica el
  primero) y la carrera entre "Listo" y una anulación del administrador, sin bloqueos
  explícitos.
- **Alternativas consideradas**: `SELECT … FOR UPDATE` (más código para el mismo resultado);
  sin control (dos toques seguidos saltarían de Pendiente a Listo, lo que prohíbe AC-2.3).

## 3. "Deshacer"

- **Decisión**: "Deshacer" retrocede un paso (`Listo → En preparación`,
  `En preparación → Pendiente`), con confirmación, mientras la comanda esté activa o lleve
  menos de 30 minutos en "Completadas". Un "Listo" cuyo aviso ya fue marcado "Visto" no se
  deshace (`409 READY_ALREADY_SEEN`). Al deshacer un "Listo", el aviso abierto se retira.
- **Razón**: los estados son lineales, así que "volver al estado anterior" y "retroceder un
  paso" coinciden; no hace falta guardar una pila de cambios. La regla del aviso visto viene
  de la clarificación del 2026-10-29.

## 4. Avisos de plato listo

- **Decisión**: Cocina es dueña del aviso (tabla `ready_notices`), lo crea al pasar un ítem a
  "Listo" y lo dirige al mozo responsable de la mesa (`Order.waiterId` de la 003). El mozo lo
  consulta con `GET /api/kitchen/ready-notices` y lo cierra con
  `POST /api/kitchen/ready-notices/:id/seen`. La bandeja de avisos es un componente de cocina
  (`ReadyNoticesTray`) que se muestra en el encabezado de la aplicación para el rol mozo, en
  cualquier pantalla.
- **Razón**: el plan del equipo asigna el aviso al módulo Cocina; tener la bandeja en el
  encabezado cumple a la vez AC-3.x de esta spec y US4-AS3 de la 003 ("aunque esté en otra
  pantalla").
- **A confirmar con 003**: que la vista del mozo no implemente un segundo aviso propio.

## 5. Avisos de anulación y "Entendido"

- **Decisión**: cada anulación registrada por la 003 (una fila de anulación con sus unidades)
  es un aviso pendiente para cocina mientras no exista su confirmación en
  `kitchen_void_acks`. "Entendido" crea esa fila y avisa a todas las pantallas de cocina. Una
  comanda con todos sus ítems anulados sigue visible como "Comanda anulada" hasta que todas
  sus anulaciones estén confirmadas; así AC-5.4 y AC-5.5 usan el mismo mecanismo.
- **Razón**: no se necesita un bus de eventos entre módulos: los avisos pendientes se
  derivan de los datos. El evento en tiempo real de la 003 solo hace que la pantalla vuelva a
  consultar.
- **Alternativas consideradas**: `@nestjs/event-emitter` para que `orders` notifique a
  `kitchen` dentro del servidor (dependencia nueva sin necesidad); una confirmación aparte para
  la comanda y para cada anulación (dos toques para enterarse de lo mismo).

## 6. Tiempo real: el evento avisa, la consulta manda

- **Decisión**: la pantalla de cocina guarda el tablero en TanStack Query
  (`GET /api/kitchen/board`). Cualquier evento que la afecte (envío nuevo, anulación, cambio
  de estado, confirmación) invalida esa consulta y se vuelve a pedir el tablero. Al reconectarse
  el socket, también se vuelve a pedir.
- **Razón**: el tablero es pequeño (como máximo unas 60 comandas por servicio) y responderlo
  completo garantiza orden por número de envío, cero duplicados (FR-007) y recuperación tras
  un corte (FR-025), sin lógica de fusión en el cliente. Sigue la garantía de la 001: "los
  eventos son una mejora de experiencia; la consulta es la garantía".
- **Alternativas consideradas**: aplicar los cambios de cada evento sobre el estado local
  (más rápido, pero con riesgo de duplicar o perder comandas si llega un evento repetido o se
  pierde uno).

## 7. Un solo socket por cliente

- **Decisión**: el socket que abre `useRealtime` en `AppShell` se expone con un
  `RealtimeContext` y un hook `useRealtimeEvent(evento, manejador)`. Cocina y la bandeja de
  avisos se suscriben a ese mismo socket.
- **Razón**: hoy `connectRealtime()` crea una conexión nueva en cada llamada; abrir una segunda
  por pantalla duplicaría conexiones y salas. Es un cambio pequeño en `apps/web/src/lib/` y
  `features/auth/useRealtime.ts` de la 001 que se coordina con su dueño.

## 8. Nuevas comandas: resaltado y sonido

- **Decisión**: el cliente compara los números de envío del tablero nuevo con los que ya
  mostraba; los nuevos se resaltan 10 s y suenan una vez. El sonido se genera con la Web Audio
  API (un tono corto), sin archivos. El interruptor "Silenciar" se guarda por dispositivo en
  `localStorage`. Si el navegador bloquea el audio (por ejemplo, tras recargar la página), se
  muestra el botón "Activar sonido", que lo habilita con un toque.
- **Razón**: no requiere dependencias ni recursos; la política de reproducción automática de
  los navegadores exige un gesto del usuario, que ya existe al ingresar.

## 9. Tiempo de espera y reloj

- **Decisión**: el tablero incluye `serverTime`; el cliente calcula la diferencia con su reloj
  y muestra los minutos transcurridos desde `sentAt`, recalculando cada 15 s. Umbrales fijos:
  15 min ("Demorado", ámbar) y 25 min ("Muy demorado", rojo), siempre con texto.
- **Razón**: la tablet de cocina puede tener la hora desfasada; usar la hora del servidor
  mantiene los umbrales correctos. Las pruebas usan relojes falsos de Vitest.

## 10. Mensaje de permiso (AC-2.7)

- **Decisión**: los endpoints de cocina se protegen con `@Roles(Role.KITCHEN)`; los demás roles
  reciben el `403 FORBIDDEN` global de la 001 ("No tienes permiso para realizar esta acción").
  AC-2.7 se ajustó para usar ese mensaje.
- **Razón**: un mensaje propio por módulo exigiría cambiar el `RolesGuard` compartido sin
  aportar valor; la pantalla de cocina ni siquiera se muestra a mozos y cajeros.

## 11. Estrategia de pruebas

- **Decisión**: igual que la 001. Títulos `"[004] AC-x.y: …"`; `npm run check:ac -- 004` en CI
  cuando empiece la implementación. Las pruebas de API crean envíos e ítems con fábricas que
  insertan directamente en las tablas de la 003.
- **Dependencia**: la implementación empieza cuando la migración de la 003 (mesas, pedidos,
  envíos, ítems y anulaciones) esté en `main`.
