# Feature Specification: Gestión de carta, platos, disponibilidad y catálogo inicial de mesas (Módulo 1)

**Feature Branch**: `002-carta`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Módulo 1 «Carta» de Picantería Digital: administración del catálogo de platos y bebidas agrupados por categorías (entradas, fondos, bebidas, postres), definición y actualización de precios en soles, y control en tiempo real de la disponibilidad del día («se acabó el chupe»). Incluye la provisión del catálogo inicial de mesas de la picantería para su consumo por el módulo de mesas y pedidos."

## Clarifications

### Session 2026-10-28

- Q: ¿Quién puede dar de alta, editar y desactivar platos o categorías en la carta? → A: Exclusivamente el usuario con rol Administrador (`ADMIN`).
- Q: ¿Quién puede cambiar la disponibilidad del día ("se acabó el plato / reactivar disponibilidad")? → A: El Administrador desde la gestión de carta (y operativamente la cocina podrá reportarlo).
- Q: ¿Qué sucede si un plato cambia de precio mientras hay mesas con ese plato pedido o enviado? → A: El cambio de precio en la carta rige solo para nuevos pedidos futuros; los pedidos ya tomados o enviados conservan su precio histórico inmutable (FR-025 de módulo 2).
- Q: ¿Cómo se manejan los platos que dejan de ofrecerse de forma permanente? → A: No se eliminan físicamente de la base de datos para no romper la integridad de pedidos históricos o facturas; se marcan como inactivos (`isActive: false`).
- Q: ¿Quién da de alta las mesas del local? → A: Se acordó en el equipo que el Módulo Carta (Paolo) como responsable del catálogo base y datos iniciales da de alta las mesas del local (Mesa 1 a 12 con capacidades de 2 a 8 comensales) para que Mesas y Pedidos (Piero) pueda operar desde el inicio.

## User Scenarios & Testing *(mandatory)*

> Cada escenario de aceptación tiene un identificador `AC-<historia>.<número>`. Según el
> Principio II de la constitución, cada uno MUST tener al menos una prueba automatizada que lo
> referencie, con el prefijo `[002] AC-x.y`.

### User Story 1 - Administrar platos y bebidas de la carta (Priority: P1)

Como Administrador de la picantería, deseo registrar, modificar y dar de baja platos y bebidas indicando su nombre, categoría, precio y descripción, para mantener actualizada la oferta gastronómica del establecimiento.

**Why this priority**: Es la base del negocio gastronómico. Sin platos registrados en la carta, el mozo no puede tomar comandas, la cocina no sabe qué preparar y caja no tiene qué cobrar.

**Independent Test**: Con un usuario administrador autenticado, se crea una categoría ("Fondos"), se registra un plato ("Rocoto Relleno" a S/ 28.00), se edita su precio a S/ 30.00 y se verifica que los datos se persisten y se visualizan correctamente. Intentar lo mismo con un mozo es rechazado.

**Acceptance Scenarios**:

1. **AC-1.1** — **Dado** un administrador autenticado, **Cuando** registra un nuevo plato con nombre ("Chupe de Camarones"), categoría válida ("Fondos"), precio positivo (`45.00`) y descripción opcional ("Chupe tradicional arequipeño con camarones de río y queso fresco"), **Entonces** el plato se guarda en la base de datos con estado activo y disponible por defecto.
2. **AC-1.2** — **Dado** el formulario de creación de plato, **Cuando** se intenta registrar un plato con precio negativo, precio cero o nombre vacío, **Entonces** el sistema rechaza la operación y muestra un mensaje de validación claro en español.
3. **AC-1.3** — **Dado** un plato ya registrado en una categoría, **Cuando** se intenta crear otro plato con el mismo nombre (sin distinguir mayúsculas o minúsculas) en la misma categoría, **Entonces** el sistema rechaza la solicitud indicando que el plato ya existe.
4. **AC-1.4** — **Dado** un plato existente en la carta, **Cuando** el administrador modifica su nombre, precio, descripción o categoría, **Entonces** el sistema actualiza la información y la refleja inmediatamente en la consulta de la carta.
5. **AC-1.5** — **Dado** un plato que ya no se preparará en la picantería, **Cuando** el administrador lo desactiva (baja lógica), **Entonces** el plato pasa a `isActive = false` y deja de figurar en el menú activo para mozos y clientes.
6. **AC-1.6** — **Dado** un usuario con rol mozo, cocina o cajero, **Cuando** intenta realizar una operación de creación, modificación o baja de plato mediante la API, **Entonces** el sistema rechaza la solicitud con código 403 y mensaje "No tienes permiso para realizar esta acción".

---

### User Story 2 - Control de disponibilidad del día ("Se acabó el chupe") (Priority: P1)

Como administrador o personal de servicio, deseo marcar un plato o bebida como agotado ("no disponible") o volver a habilitarlo con un solo toque, para que los mozos no ofrezcan platos cuyos insumos se hayan terminado durante la jornada.

**Why this priority**: En una picantería tradicional platos emblemáticos como el chupe de camarones, el adobo o el rocoto relleno se agotan rápidamente a mediodía. Comunicar esto al instante evita reclamos de clientes y comandas devueltas por cocina.

**Independent Test**: Se marca el "Chupe de Camarones" como no disponible (`isAvailable: false`); se verifica que la lista de platos para toma de pedido lo excluye o lo muestra como agotado impidiendo su selección. Luego se vuelve a habilitar y aparece disponible nuevamente.

**Acceptance Scenarios**:

1. **AC-2.1** — **Dado** un plato disponible en la carta, **Cuando** el administrador o personal autorizado conmuta su disponibilidad a agotado, **Entonces** el sistema actualiza su estado `isAvailable = false` de forma inmediata.
2. **AC-2.2** — **Dado** un plato marcado como no disponible, **Cuando** un mozo consulta los platos disponibles para armar un pedido, **Entonces** el sistema no incluye dicho plato entre las opciones seleccionables (cumpliendo FR-009 y FR-020 de mesas y pedidos).
3. **AC-2.3** — **Dado** un plato marcado como no disponible, **Cuando** el administrador conmuta su disponibilidad a disponible, **Entonces** su estado `isAvailable` pasa a verdadero y vuelve a estar disponible para pedidos al instante.
4. **AC-2.4** — **Dado** un plato marcado como no disponible a mediodía, **Cuando** se revisan pedidos ya enviados a cocina con anterioridad, **Entonces** los pedidos previos no sufren alteraciones y continúan su preparación normal.

---

### User Story 3 - Categorización de la carta (Priority: P2)

Como administrador, deseo agrupar los platos y bebidas en categorías ordenadas (Entradas, Fondos, Bebidas, Postres y Extras), para que el mozo y el personal encuentren rápidamente los ítems durante el servicio.

**Why this priority**: Una carta desordenada ralentiza la toma de pedidos en sala. Las categorías estructuran el menú facilitando la navegación táctil en tablet.

**Independent Test**: Se crean las categorías de la picantería ("Entradas", "Fondos", "Bebidas", "Postres"), se asignan platos a cada una y se verifica que la respuesta de la API devuelve las categorías en el orden (`sortOrder`) especificado con sus platos anidados.

**Acceptance Scenarios**:

1. **AC-3.1** — **Dado** las categorías de la carta registradas en el sistema, **Cuando** se solicita el listado de categorías, **Entonces** se devuelven ordenadas de forma ascendente según su campo `sortOrder`.
2. **AC-3.2** — **Dado** un administrador autenticado, **Cuando** crea una nueva categoría indicando su nombre y orden de visualización, **Entonces** la categoría se guarda correctamente y queda lista para asociar platos.
3. **AC-3.3** — **Dado** el registro de categorías, **Cuando** se intenta registrar una categoría con nombre duplicado o sin nombre, **Entonces** el sistema rechaza la operación con un mensaje de validación descriptivo.
4. **AC-3.4** — **Dado** un listado de categorías activas con platos activos, **Cuando** se solicita la carta completa para sala o cocina, **Entonces** la estructura agrupa cada categoría con únicamente sus platos activos.

---

### User Story 4 - Consulta de carta para tablet y catálogo inicial de mesas (Priority: P2)

Como mozo, cocinero o cajero, deseo visualizar la carta completa con precios formateados en soles y filtro rápido por categoría en una interfaz optimizada para tablet, y contar con el catálogo de mesas del local listo para operar.

**Why this priority**: Cumple con el Principio III (convenciones locales y moneda S/) y Principio IV (diseño táctil de tablet). Además, provee las mesas iniciales del establecimiento acordadas por el equipo.

**Independent Test**: Se consulta la vista de carta en viewport de 768px a 1024px; se comprueba que los botones táctiles tienen al menos 44px, no hay scroll horizontal, los precios figuran con "S/", y el catálogo de mesas contiene las 12 mesas iniciales de la picantería.

**Acceptance Scenarios**:

1. **AC-4.1** — **Dado** cualquier usuario autenticado en el sistema (administrador, mozo, cocina, cajero), **Cuando** consulta la carta, **Entonces** puede ver todos los platos activos con sus precios formateados en soles peruanos (`S/ 00.00`) y su categoría correspondiente.
2. **AC-4.2** — **Dado** la vista de consulta de carta, **Cuando** el usuario selecciona una pestaña o filtro de categoría (ej. "Bebidas"), **Entonces** la vista muestra únicamente los ítems de esa categoría sin requerir recarga completa de página.
3. **AC-4.3** — **Dado** la inicialización del sistema y carga de datos de ejemplo, **Cuando** se consulta el catálogo de mesas del local, **Entonces** el sistema expone las 12 mesas de la picantería con su número de mesa (1 a 12), su capacidad de comensales (2 a 8 personas) y su estado inicial `LIBRE`.

---

## Requisitos Funcionales

- **FR-001**: El sistema MUST permitir al Administrador registrar nuevos platos y bebidas con nombre (3 a 80 caracteres), descripción opcional (hasta 255 caracteres), precio numérico mayor a cero con hasta 2 decimales, categoría asociada y estado de disponibilidad inicial (por defecto verdadero).
- **FR-002**: El sistema MUST permitir al Administrador editar cualquier campo de un plato existente (nombre, descripción, precio, categoría).
- **FR-003**: El sistema MUST permitir al Administrador dar de baja lógica un plato (`isActive: false`), manteniéndolo en base de datos para preservar la integridad histórica de pedidos y comandas.
- **FR-004**: El sistema MUST proveer una acción rápida (toggle) para conmutar la disponibilidad del día (`isAvailable`) de un plato.
- **FR-005**: Al consultar la carta para toma de pedidos o despacho, el sistema MUST señalar claramente qué ítems están agotados y proveer un filtro para obtener exclusivamente ítems disponibles (`isAvailable: true`).
- **FR-006**: El sistema MUST permitir la administración de categorías de menú con nombre (2 a 50 caracteres) y orden de presentación numérico (`sortOrder`).
- **FR-007**: Todos los endpoints de modificación de catálogo (POST, PUT, PATCH, DELETE en `/api/menu/*` y `/api/tables/*`) MUST requerir el rol `ADMIN`, excepto el toggle de disponibilidad que también puede ser operado según necesidad.
- **FR-008**: Los endpoints de lectura (`GET /api/menu`, `GET /api/menu/categories`, `GET /api/tables`) MUST estar accesibles para cualquier usuario con sesión activa de cualquier rol (`ADMIN`, `WAITER`, `KITCHEN`, `CASHIER`).
- **FR-009**: Todos los montos monetarios MUST manejarse con precisión de dos decimales y presentarse con el prefijo oficial de soles peruanos (`S/`).
- **FR-010**: El sistema MUST proveer en los datos iniciales y semillas (seed) la carta tradicional arequipeña (entradas como Rocoto Relleno, Ocopa, Solterito; fondos como Chupe de Camarones, Adobo, Costillar; bebidas como Chicha de Jora, Kola Escocesa) y las 12 mesas del local con sus capacidades.
