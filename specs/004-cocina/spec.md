# Feature Specification: Módulo Cocina — pantalla de comandas

**Feature Branch**: `004-cocina`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Módulo Cocina: pantalla de comandas en orden de llegada, cambio de estado por ítem (pendiente → en preparación → listo), aviso al mozo cuando un plato está listo y tiempo de espera visible."

## Clarifications

### Session 2026-10-28

Decisiones tomadas al alinear esta spec con `003-mesas-pedidos` (módulo Mesas y pedidos).

- Q: ¿A quién llega el aviso de plato listo? → A: Solo al mozo responsable de la mesa (el que
  la abrió), aunque otro mozo haya enviado esa ronda. Coincide con `003-mesas-pedidos`
  US4-AS4 y FR-027.
- Q: ¿Qué ítems llegan a la pantalla de cocina? → A: Todos los del envío, bebidas incluidas:
  la cocina es la única área de preparación y no hay barra. Reemplaza la decisión inicial de
  excluir las bebidas, para coincidir con `003-mesas-pedidos`.
- Q: ¿El administrador puede anular solo algunas unidades de un ítem ya enviado? → A: Sí.
  La cocina ve cuántas unidades se anularon y cuántas quedan por preparar; el ítem sigue su
  curso con las restantes.
- Q: ¿Cómo se identifica y ordena cada comanda? → A: Por el número correlativo del envío a
  cocina. Reintentar un envío cuyo resultado quedó incierto no crea una comanda duplicada.
- Q: ¿Se puede anular un plato que la cocina ya marcó Listo? → A: No (`003-mesas-pedidos`
  FR-030); la cocina solo recibe anulaciones de ítems Pendientes o En preparación.

## User Scenarios & Testing *(mandatory)*

Una **comanda** es lo que la cocina ve de un **envío a cocina** del módulo Mesas y pedidos: una
ronda de ítems que un mozo manda de una vez para una mesa. Cada envío tiene un número
correlativo que fija el orden de llegada.

El **mozo responsable** de una mesa es el mozo que la abrió (definición de `003-mesas-pedidos`).

Los criterios de aceptación se identifican como `CA-<historia>.<número>`; cada prueba
automatizada debe citar el identificador del criterio que cubre (Constitución, Principio II).

### User Story 1 - Ver las comandas en orden de llegada (Priority: P1)

El personal de cocina tiene una tablet con la pantalla de comandas abierta durante todo el
servicio. Cada vez que un mozo envía un pedido a cocina, aparece una comanda nueva al final de
la lista, sin que nadie en cocina tenga que tocar la pantalla. Las comandas se muestran en el
orden en que llegaron, de modo que la cocina sabe siempre qué va primero.

**Why this priority**: es el corazón del módulo y reemplaza la comanda de papel. Sin esta
pantalla la cocina no recibe los pedidos y el resto del flujo (cocina → cobro) no existe.

**Independent Test**: se envían pedidos de varias mesas en un orden conocido y se comprueba
que la pantalla de cocina los muestra todos, una sola vez, en ese orden y con su contenido
completo.

**Acceptance Scenarios**:

1. **CA-1.1** — **Dado** que no hay comandas activas, **cuando** la cocina abre la pantalla,
   **entonces** ve el mensaje "No hay pedidos pendientes".
2. **CA-1.2** — **Dado** que el envío N.º 12 (mesa 4, 12:05) y el envío N.º 13 (mesa 2,
   12:10) están activos, **cuando** la cocina mira la pantalla, **entonces** la comanda N.º 12
   aparece antes que la N.º 13.
3. **CA-1.3** — **Dado** que la pantalla de cocina está abierta, **cuando** un mozo envía un
   pedido nuevo, **entonces** la comanda aparece al final de la lista en pocos segundos, sin
   recargar ni tocar la pantalla, resaltada como nueva y acompañada de un sonido breve.
4. **CA-1.4** — **Dado** una comanda en pantalla, **cuando** la cocina la lee, **entonces**
   ve el número de envío, el número de mesa, el nombre del mozo que la envió, la hora de
   llegada y, por cada ítem, la cantidad, el nombre del plato o bebida y la nota del mozo
   (por ejemplo "sin ají") resaltada.
5. **CA-1.5** — **Dado** que la mesa 3 ya tiene una comanda en cocina, **cuando** un mozo
   envía otra ronda para esa mesa, **entonces** llega como una comanda nueva, con su propio
   número y hora, identificada como "Mesa 3 · 2.ª ronda".
6. **CA-1.6** — **Dado** que un mozo reintentó un envío cuyo resultado había quedado incierto
   por un corte de conexión, **cuando** la cocina mira la pantalla, **entonces** esa comanda
   aparece una sola vez.
7. **CA-1.7** — **Dado** un envío con 1 adobo y 2 chichas moradas, **cuando** llega a cocina,
   **entonces** la comanda muestra los dos ítems, bebidas incluidas.

---

### User Story 2 - Actualizar el estado de cada plato (Priority: P1)

Cuando la cocina empieza un plato, lo marca "En preparación"; cuando lo termina, lo marca
"Listo". Cada cambio se hace con un solo toque sobre el ítem. Cuando todos los ítems de una
comanda están listos, la comanda sale de la lista de activas para que la pantalla muestre solo
lo que falta preparar.

**Why this priority**: sin estados, la pantalla es solo una lista; los estados permiten saber
qué está en curso y son el disparador del aviso al mozo (Historia 3).

**Independent Test**: sobre una comanda con varios ítems se recorren los estados de cada uno
y se verifica la secuencia permitida, el registro de horas y el retiro de la comanda completa.

**Acceptance Scenarios**:

1. **CA-2.1** — **Dado** un ítem "Pendiente", **cuando** la cocina toca "Preparar",
   **entonces** el ítem pasa a "En preparación" y se registra la hora del cambio.
2. **CA-2.2** — **Dado** un ítem "En preparación", **cuando** la cocina toca "Listo",
   **entonces** el ítem pasa a "Listo" y se registra la hora del cambio.
3. **CA-2.3** — **Dado** un ítem "Pendiente", **cuando** se intenta marcarlo "Listo" sin pasar
   por "En preparación", **entonces** el sistema no lo permite.
4. **CA-2.4** — **Dado** una comanda cuyos ítems no anulados están todos "Listo",
   **cuando** se marca el último, **entonces** la comanda sale de la lista de activas y pasa a
   la sección "Completadas", donde permanece visible 30 minutos.
5. **CA-2.5** — **Dado** un ítem cuyo estado se cambió por error, **cuando** la cocina toca
   "Deshacer" y confirma, **entonces** el ítem vuelve a su estado anterior; si la comanda
   estaba en "Completadas", vuelve a la lista de activas en su posición original.
6. **CA-2.6** — **Dado** dos pantallas de cocina abiertas, **cuando** en una se cambia el
   estado de un ítem, **entonces** la otra muestra el cambio en pocos segundos sin recargar.
7. **CA-2.7** — **Dado** un usuario con rol Mozo o Cajero, **cuando** intenta cambiar el
   estado de un ítem de cocina, **entonces** el sistema lo rechaza con el mensaje "No tienes
   permiso para cambiar el estado de los platos".

---

### User Story 3 - Avisar al mozo cuando un plato está listo (Priority: P2)

Cuando la cocina marca un plato como "Listo", el mozo responsable de la mesa recibe un aviso en
su celular o tablet con la mesa, el plato y la cantidad, sin tener que acercarse a preguntar. El
aviso se mantiene hasta que el mozo lo marca como visto.

**Why this priority**: evita que los platos se enfríen esperando y que el mozo interrumpa a la
cocina, pero el flujo básico (cocina recibe y prepara) funciona sin él.

**Independent Test**: se marca un ítem como "Listo" y se verifica que el aviso llega al mozo
responsable, persiste hasta que lo marca como visto y no llega a ningún otro mozo.

**Acceptance Scenarios**:

1. **CA-3.1** — **Dado** que el mozo Juan abrió la mesa 5, **cuando** la cocina marca
   "2 × Ají de gallina" como "Listo", **entonces** Juan ve en pocos segundos el aviso
   "Mesa 5: 2 × Ají de gallina — listo" sin recargar.
2. **CA-3.2** — **Dado** un aviso de plato listo visible, **cuando** el mozo toca "Visto",
   **entonces** el aviso desaparece de su vista; mientras no lo toque, el aviso permanece.
3. **CA-3.3** — **Dado** que el mozo no tenía la aplicación abierta cuando el plato quedó
   listo, **cuando** vuelve a abrirla, **entonces** ve todos sus avisos pendientes.
4. **CA-3.4** — **Dado** un aviso de plato listo, **cuando** la cocina deshace ese "Listo"
   (CA-2.5), **entonces** el aviso se retira de la vista del mozo.
5. **CA-3.5** — **Dado** que Juan abrió la mesa 5 y la mesera Rosa envió su segunda ronda,
   **cuando** la cocina marca "Listo" un plato de esa ronda, **entonces** el aviso llega solo
   a Juan; ni Rosa ni ningún otro mozo lo reciben.

---

### User Story 4 - Ver el tiempo de espera y detectar demoras (Priority: P2)

Cada comanda muestra cuántos minutos lleva esperando desde que llegó a cocina. Las comandas que
se demoran se destacan para que la cocina las atienda antes de que el cliente reclame.

**Why this priority**: ayuda a cumplir el orden de llegada y a reaccionar ante demoras, pero
la cocina puede operar sin él.

**Independent Test**: con un reloj controlado se deja pasar el tiempo sobre una comanda y se
comprueba el contador y el cambio de nivel de alerta en los umbrales definidos.

**Acceptance Scenarios**:

1. **CA-4.1** — **Dado** una comanda activa, **cuando** la cocina la mira, **entonces** ve el
   tiempo transcurrido desde su llegada en minutos, actualizado solo, sin recargar.
2. **CA-4.2** — **Dado** una comanda con 15 minutos o más de espera, **entonces** se muestra
   con la marca "Demorado" y color ámbar; con 25 minutos o más, con la marca "Muy demorado" y
   color rojo. La marca de texto se muestra siempre junto al color.
3. **CA-4.3** — **Dado** una comanda que pasa a "Completadas", **entonces** su contador se
   detiene y muestra el tiempo total que tomó.

---

### User Story 5 - Enterarse de los platos anulados (Priority: P3)

Si el administrador autoriza la anulación de un ítem que ya estaba en cocina (por ejemplo, el
cliente cambió de opinión), la cocina lo ve de inmediato y deja de prepararlo. La anulación
puede ser del ítem completo o solo de algunas de sus unidades.

**Why this priority**: evita desperdicio y confusiones, pero las anulaciones son poco
frecuentes; el flujo principal funciona sin esta historia.

**Independent Test**: se anula un ítem completo y parte de otro (con autorización del
administrador desde el módulo Mesas y pedidos) y se verifica cómo se muestran en cocina.

**Acceptance Scenarios**:

1. **CA-5.1** — **Dado** un ítem "Pendiente" o "En preparación", **cuando** el
   administrador anula todas sus unidades, **entonces** en la pantalla de cocina el ítem
   aparece tachado con la etiqueta "ANULADO" y ya no se puede cambiar su estado.
2. **CA-5.2** — **Dado** un ítem de 3 rocotos rellenos "En preparación", **cuando** el
   administrador anula 1 unidad, **entonces** la cocina ve en pocos segundos que ahora debe
   preparar 2, con la indicación "1 anulada", y el ítem conserva su estado y sigue avanzando.
3. **CA-5.3** — **Dado** una comanda con un ítem anulado, **cuando** el resto de sus ítems
   pasa a "Listo", **entonces** la comanda se completa normalmente.
4. **CA-5.4** — **Dado** una comanda cuyos ítems fueron anulados en su totalidad,
   **entonces** permanece en la lista marcada como "Comanda anulada" hasta que la cocina toca
   "Entendido".

---

### Edge Cases

- **Pérdida de conexión de la tablet de cocina**: la pantalla muestra un aviso visible
  "Sin conexión — los pedidos nuevos no se están recibiendo". Al reconectarse, se
  sincroniza sola y muestra todas las comandas, estados y anulaciones actuales, sin perder ni
  duplicar ninguna.
- **Envío reintentado por el mozo**: si el mozo reintenta un envío cuyo resultado quedó
  incierto, la cocina no ve una segunda comanda (CA-1.6).
- **Cambio simultáneo del mismo ítem desde dos pantallas**: se aplica el primero; la
  segunda pantalla ve el estado ya actualizado y su acción no produce un salto de estado.
- **Ítem con cantidad mayor a 1** (por ejemplo, 3 rocotos rellenos): el estado se lleva por
  ítem, no por unidad; las unidades no anuladas pasan juntas de estado.
- **Anulaciones parciales sucesivas**: si se anula 1 de 3 y luego otra, la cocina ve
  "preparar 1 (2 anuladas)"; si se anulan todas, el ítem queda "ANULADO".
- **El administrador intenta anular un ítem que la cocina acaba de marcar Listo**: la
  anulación se rechaza en el módulo Mesas y pedidos; en cocina el ítem sigue "Listo".
- **Mesa que estaba "por cobrar" y pide algo más**: el nuevo envío llega a cocina como una
  ronda más de esa mesa, sin tratamiento especial.
- **Pedido enviado mientras la cocina recarga la pantalla**: la comanda aparece igual al
  terminar de cargar; ninguna comanda se pierde por el momento en que se envió.
- **Muchas comandas activas** (todas las mesas ocupadas): la lista se desplaza solo en
  vertical y la comanda más antigua sigue siendo la primera visible al abrir la pantalla.
- **Plato que deja de estar disponible en la carta después de enviado**: no afecta a las
  comandas ya enviadas; la cocina lo sigue viendo y preparando salvo que se anule.

## Requirements *(mandatory)*

### Functional Requirements

**Pantalla de comandas**

- **FR-001**: El sistema MUST mostrar a los usuarios con rol Cocina (y Administrador) una
  pantalla con todas las comandas activas, ordenadas por el número correlativo de su envío, de
  la más antigua a la más reciente.
- **FR-002**: Cada envío a cocina confirmado en el módulo Mesas y pedidos MUST mostrarse como una
  comanda con su número correlativo, la mesa, el mozo que lo envió, la hora de llegada y todos
  sus ítems (plato o bebida, cantidad y nota), bebidas incluidas.
- **FR-003**: Las comandas nuevas MUST aparecer en la pantalla de cocina sin que el usuario
  recargue ni realice ninguna acción, y MUST destacarse visualmente durante 10 segundos y
  anunciarse con un sonido breve que la cocina puede silenciar.
- **FR-004**: Cada comanda MUST indicar qué ronda de su mesa es (por ejemplo, "Mesa 3 · 2.ª
  ronda"); una ronda nueva no altera la posición de las anteriores.
- **FR-005**: Las notas del mozo por ítem MUST mostrarse resaltadas junto al plato.
- **FR-006**: Si no hay comandas activas, la pantalla MUST mostrar "No hay pedidos pendientes".
- **FR-007**: Cada envío MUST mostrarse como una sola comanda, aunque el mozo lo reintente o la
  pantalla de cocina se reconecte; dos comandas con el mismo número de envío nunca coexisten.

**Estados de los ítems**

- **FR-008**: Cada ítem de comanda MUST tener uno de estos estados: Pendiente, En preparación,
  Listo o Anulado. Todo ítem recién enviado empieza en Pendiente.
- **FR-009**: La cocina MUST poder avanzar un ítem solo un paso a la vez
  (Pendiente → En preparación → Listo), con un único toque por paso.
- **FR-010**: El sistema MUST registrar la hora de cada cambio de estado de un ítem.
- **FR-011**: La cocina MUST poder deshacer el último cambio de estado de un ítem, previa
  confirmación, mientras la comanda esté activa o en "Completadas".
- **FR-012**: Solo los usuarios con rol Cocina o Administrador MUST poder cambiar el estado de
  un ítem; cualquier otro intento MUST rechazarse con un mensaje en español.
- **FR-013**: Cuando todos los ítems no anulados de una comanda están en Listo, la comanda
  MUST salir de la lista de activas y mostrarse en "Completadas" durante 30 minutos.
- **FR-014**: Los cambios de estado MUST reflejarse en todas las pantallas de cocina abiertas
  sin recargar.

**Aviso al mozo**

- **FR-015**: Cuando un ítem pasa a Listo, el sistema MUST generar un aviso con la mesa, el
  plato y la cantidad, dirigido únicamente al mozo responsable de la mesa, aunque el ítem lo haya
  enviado otro mozo.
- **FR-016**: El aviso MUST mostrarse sin que el mozo recargue y MUST permanecer visible hasta
  que el mozo lo marque como "Visto".
- **FR-017**: Los avisos no vistos MUST seguir disponibles cuando el mozo vuelve a abrir la
  aplicación.
- **FR-018**: Si la cocina deshace un "Listo", el aviso correspondiente MUST retirarse.

**Tiempo de espera**

- **FR-019**: Cada comanda activa MUST mostrar los minutos transcurridos desde su llegada,
  actualizados automáticamente al menos una vez por minuto.
- **FR-020**: Las comandas con 15 minutos o más de espera MUST marcarse como "Demorado" y las
  de 25 minutos o más como "Muy demorado", con texto además del color.
- **FR-021**: Al completarse una comanda, el contador MUST detenerse y mostrar el tiempo total.

**Anulaciones**

- **FR-022**: Cuando el administrador anula todas las unidades de un ítem enviado, la pantalla
  de cocina MUST mostrarlo tachado con la etiqueta "ANULADO", sin recargar, y MUST impedir
  cambios de estado sobre él.
- **FR-023**: Cuando el administrador anula solo algunas unidades de un ítem, la pantalla de
  cocina MUST mostrar, sin recargar, la cantidad que queda por preparar y cuántas unidades se
  anularon; el ítem MUST conservar su estado y seguir su curso con las unidades restantes.
- **FR-024**: Una comanda totalmente anulada MUST permanecer visible como "Comanda anulada"
  hasta que la cocina la confirme con "Entendido".

**Operación**

- **FR-025**: Si la pantalla pierde conexión, MUST mostrar un aviso visible de "Sin conexión"
  y, al recuperarla, MUST sincronizarse sola sin perder ni duplicar comandas, estados ni
  anulaciones.
- **FR-026**: Todos los textos, horas y mensajes MUST estar en español y con el formato local
  de Perú.

### Key Entities *(include if feature involves data)*

- **Comanda**: es la vista de cocina de un **Envío a cocina** (entidad del módulo Mesas y
  pedidos); no es una entidad nueva. De él usa el número correlativo, la mesa, el mozo que lo
  envió, la hora y sus ítems. Cocina agrega un estado derivado (activa, completada o anulada),
  la hora en que se completó y, si fue anulada por completo, cuándo la cocina tocó "Entendido".
- **Ítem de comanda**: es el **Ítem del pedido** del módulo Mesas y pedidos visto desde
  cocina: plato o bebida, cantidad pedida, unidades anuladas, cantidad por preparar (pedida
  menos anuladas), nota, estado (Pendiente, En preparación, Listo, Anulado) y la hora de cada
  cambio de estado.
- **Aviso de plato listo**: notificación generada cuando un ítem pasa a Listo; tiene la mesa,
  el plato, la cantidad, el mozo responsable como destinatario, la hora de creación y si fue
  visto (y cuándo).
- **Referencias a otros módulos**: Mesa, Pedido y Envío a cocina (Mesas y pedidos), Plato y
  categoría (Carta), Usuario y rol (Base común).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una comanda enviada por el mozo aparece en la pantalla de cocina en menos de
  3 segundos en el 95% de los envíos, sin intervención del personal de cocina.
- **SC-002**: El mozo responsable recibe el aviso de plato listo, y la cocina ve las
  anulaciones, en menos de 3 segundos en el 95% de los casos.
- **SC-003**: En una simulación de servicio con 15 mesas ocupadas, al menos 60 envíos y cortes
  de conexión del mozo y de la cocina, el 100% de los envíos llega a cocina, ninguno aparece
  dos veces y todos se muestran en orden de llegada.
- **SC-004**: Cada cambio de estado de un ítem se completa con un solo toque.
- **SC-005**: En una prueba con personal de cocina, la persona identifica la comanda más
  antigua pendiente y su mesa en menos de 5 segundos, leyendo la tablet a distancia de trabajo
  (alrededor de 1 metro).
- **SC-006**: Tras una pérdida de conexión de hasta 5 minutos, la pantalla de cocina muestra
  el estado correcto de todas las comandas en menos de 10 segundos después de reconectarse.
- **SC-007**: Ninguna comanda de papel es necesaria durante el servicio de prueba de la demo.

## Assumptions

- **Usuarios y acceso**: el login, los roles (Administrador, Mozo, Cocina, Cajero) y la
  gestión de usuarios los provee la Base común (`001-auth-roles`). El Administrador también
  puede ver y operar la pantalla de cocina.
- **Dispositivo**: la cocina usa una o más tablets conectadas a la red del local; la pantalla
  se diseña para tablet en vertical y horizontal (Constitución, Principio IV).
- **Una sola área de preparación**: todo lo que se pide, bebidas incluidas, va a la misma
  pantalla de cocina; no hay barra ni estaciones separadas (parrilla, fríos, etc.).
- **Sin priorización manual**: el orden es estrictamente el del número de envío; la cocina no
  puede reordenar comandas en esta versión.
- **Estado por ítem**: el estado se lleva por ítem (plato + cantidad), no por unidad.
- **Umbrales de demora fijos**: 15 y 25 minutos; hacerlos configurables queda fuera de esta
  versión.
- **Anulación**: la solicitud, autorización, motivo y registro de la anulación (total o por
  unidades) se hacen en el módulo Mesas y pedidos; este módulo solo la refleja. Solo se
  anulan ítems Pendientes o En preparación.
- **Aviso solo al mozo responsable**: si ese mozo no está disponible, el plato espera en el
  pase; avisar a otros mozos queda fuera de esta versión.
- **"Visto" no es un estado de cocina**: marcar un aviso como visto solo lo cierra en la vista
  del mozo. "Listo" es el último estado que registra la cocina.
- **Contrato con Mesas y pedidos**: antes de planificar se acuerda con el responsable de
  `003-mesas-pedidos` un contrato que cubra, como mínimo:
  - "envío confirmado": número correlativo, mesa, número de ronda, mozo que envió, mozo
    responsable, hora e ítems (plato o bebida, cantidad, nota);
  - "ítem anulado": ítem, unidades anuladas en esta anulación y cantidad que queda por
    preparar;
  - "estado de ítem cambiado": incluye retrocesos por "Deshacer";
  - "plato listo": aviso dirigido al mozo responsable, y su retiro si se deshace el "Listo";
  - recuperación del estado completo al reconectarse, sin duplicados.
- **Fuera de alcance**: impresión de tickets de cocina, estimación de tiempo por plato,
  control de insumos (inventario) y estadísticas de tiempos de cocina (pueden incluirse en
  reportes como trabajo futuro).
