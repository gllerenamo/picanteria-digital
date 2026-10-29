# Feature Specification: Base común: inicio de sesión, roles y gestión de usuarios

**Feature Branch**: `001-base-comun`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Base común del sistema: inicio de sesión con usuario y contraseña, cuatro roles (administrador, mozo, cocina, cajero), cada rol ve solo las pantallas de su función. El administrador gestiona los usuarios."

## Clarifications

### Session 2026-10-28

- Q: ¿Cada usuario tiene un solo rol o puede tener varios? → A: Un solo rol por usuario
  (FR-009).
- Q: ¿El administrador puede entrar a las pantallas de mozo, cocina y cajero? → A: Sí, a todas,
  con las mismas capacidades que esos roles (FR-011, AC-2.5).

## User Scenarios & Testing *(mandatory)*

> Cada escenario de aceptación tiene un identificador `AC-<historia>.<número>`. Según el
> Principio II de la constitución, cada uno MUST tener al menos una prueba automatizada que lo
> referencie.

### User Story 1 - Iniciar sesión y llegar a la pantalla de mi función (Priority: P1)

Un trabajador de la picantería (administrador, mozo, cocina o cajero) abre la aplicación en
la tablet o computadora, ingresa su usuario y contraseña y entra directamente a la pantalla
inicial de su función. Al terminar su turno cierra sesión para que otra persona pueda usar el
mismo dispositivo.

**Why this priority**: sin inicio de sesión no existe ninguna otra función del sistema; es la
puerta de entrada de todas las features posteriores (pedidos, cocina, caja).

**Independent Test**: con un usuario de cada rol ya registrado, se puede probar iniciando
sesión con cada uno y comprobando que llega a la pantalla inicial de su rol, que las
credenciales incorrectas se rechazan y que cerrar sesión devuelve a la pantalla de ingreso.

**Acceptance Scenarios**:

1. **AC-1.1** — **Dado** un usuario activo con rol mozo, **Cuando** ingresa su usuario y
   contraseña correctos, **Entonces** entra al sistema y ve la pantalla inicial de mozo.
2. **AC-1.2** — **Dado** un usuario activo de cualquiera de los cuatro roles, **Cuando** inicia
   sesión correctamente, **Entonces** ve la pantalla inicial correspondiente a su rol
   (administrador, mozo, cocina o cajero).
3. **AC-1.3** — **Dado** la pantalla de ingreso, **Cuando** alguien ingresa una contraseña
   incorrecta o un usuario inexistente, **Entonces** el sistema no le da acceso y muestra el
   mensaje "Usuario o contraseña incorrectos", sin indicar cuál de los dos falló.
4. **AC-1.4** — **Dado** un usuario desactivado, **Cuando** ingresa sus credenciales correctas,
   **Entonces** el sistema no le da acceso y muestra un mensaje indicando que su cuenta está
   desactivada y que consulte al administrador.
5. **AC-1.5** — **Dado** un usuario con sesión iniciada, **Cuando** pulsa "Cerrar sesión",
   **Entonces** vuelve a la pantalla de ingreso y ya no puede ver ninguna pantalla interna sin
   volver a iniciar sesión.
6. **AC-1.6** — **Dado** un usuario que falló la contraseña 5 veces seguidas, **Cuando** intenta
   un sexto ingreso dentro de los 15 minutos siguientes, **Entonces** el sistema rechaza el
   ingreso aunque la contraseña sea correcta e informa que la cuenta está bloqueada
   temporalmente.
7. **AC-1.7** — **Dado** una persona sin sesión iniciada, **Cuando** intenta abrir directamente
   la dirección de una pantalla interna, **Entonces** es enviada a la pantalla de ingreso.

---

### User Story 2 - Cada rol ve solo las pantallas de su función (Priority: P2)

Una vez dentro del sistema, cada mozo, cocinero o cajero solo ve en el menú y solo puede abrir
las pantallas de su propia función. Un mozo no puede entrar a la caja ni a la gestión de
usuarios; la cocina no puede entrar a la toma de pedidos; el cajero no puede entrar a la
cocina. El administrador, en cambio, puede entrar a todas las pantallas para supervisar o
cubrir cualquier puesto.

**Why this priority**: protege la información y las operaciones sensibles (cobros, usuarios) y
simplifica la interfaz de cada trabajador. Depende de que exista el inicio de sesión (P1).

**Independent Test**: con un usuario de cada rol, se comprueba que el menú de mozo, cocina y
cajero solo muestra las opciones de su rol, que intentar abrir la dirección de una pantalla de
otro rol es rechazado y que el administrador puede abrir todas.

**Acceptance Scenarios**:

1. **AC-2.1** — **Dado** un usuario con sesión iniciada, **Cuando** observa el menú de
   navegación, **Entonces** solo aparecen las pantallas permitidas para su rol.
2. **AC-2.2** — **Dado** un usuario con rol mozo, **Cuando** intenta abrir directamente la
   dirección de una pantalla de cajero, cocina o administrador, **Entonces** el sistema no
   muestra esa pantalla y presenta el mensaje "No tienes permiso para ver esta pantalla" con
   una opción para volver a su pantalla inicial.
3. **AC-2.3** — **Dado** un usuario de cualquier rol, **Cuando** intenta ejecutar una operación
   reservada a otro rol (aunque no use la interfaz), **Entonces** el sistema rechaza la
   operación y no modifica ningún dato.
4. **AC-2.4** — **Dado** un usuario con sesión iniciada cuyo rol fue cambiado por el
   administrador, **Cuando** realiza su siguiente acción, **Entonces** el sistema aplica los
   permisos del nuevo rol.
5. **AC-2.5** — **Dado** un administrador con sesión iniciada, **Cuando** abre una pantalla de
   mozo, cocina o cajero desde el menú o por su dirección, **Entonces** el sistema se la
   muestra y le permite realizar las mismas operaciones que a ese rol.
6. **AC-2.6** — **Dado** un usuario con rol mozo, cocina o cajero, **Cuando** intenta abrir la
   gestión de usuarios, **Entonces** el sistema la rechaza con el mensaje "No tienes permiso
   para ver esta pantalla".

---

### User Story 3 - El administrador gestiona los usuarios (Priority: P3)

El administrador da de alta a los trabajadores nuevos, les asigna su rol, corrige sus datos,
les restablece la contraseña cuando la olvidan y desactiva a quienes dejan de trabajar en la
picantería.

**Why this priority**: permite operar el sistema sin intervención técnica cuando cambia el
personal. Para las pruebas de P1 y P2 basta con usuarios precargados, por eso va después.

**Independent Test**: un administrador crea un usuario de cada rol, comprueba que pueden
iniciar sesión, cambia el rol de uno, restablece la contraseña de otro y desactiva un tercero,
verificando el efecto de cada acción en el inicio de sesión de ese usuario.

**Acceptance Scenarios**:

1. **AC-3.1** — **Dado** un administrador en la pantalla de usuarios, **Cuando** registra un
   usuario con nombre completo, nombre de usuario, contraseña inicial y rol, **Entonces** el
   usuario aparece en la lista como activo y puede iniciar sesión con esas credenciales.
2. **AC-3.2** — **Dado** un nombre de usuario ya registrado (sin distinguir mayúsculas de
   minúsculas), **Cuando** el administrador intenta crear otro usuario con el mismo nombre,
   **Entonces** el sistema rechaza el registro e indica que el nombre de usuario ya existe.
3. **AC-3.3** — **Dado** un administrador, **Cuando** intenta registrar una contraseña de menos
   de 8 caracteres, **Entonces** el sistema rechaza el registro e indica la longitud mínima.
4. **AC-3.4** — **Dado** un usuario existente, **Cuando** el administrador cambia su nombre
   completo o su rol, **Entonces** el cambio queda guardado y se refleja en la lista.
5. **AC-3.5** — **Dado** un usuario que olvidó su contraseña, **Cuando** el administrador le
   asigna una contraseña nueva, **Entonces** el usuario puede iniciar sesión con la nueva y ya
   no con la anterior.
6. **AC-3.6** — **Dado** un usuario activo, **Cuando** el administrador lo desactiva (tras
   confirmar la acción), **Entonces** ese usuario ya no puede iniciar sesión, su sesión abierta
   deja de ser válida y sigue apareciendo en la lista marcado como inactivo.
7. **AC-3.7** — **Dado** un usuario desactivado, **Cuando** el administrador lo reactiva,
   **Entonces** el usuario puede volver a iniciar sesión con su contraseña.
8. **AC-3.8** — **Dado** que solo queda un administrador activo, **Cuando** se intenta
   desactivarlo o quitarle el rol de administrador, **Entonces** el sistema rechaza la acción e
   indica que debe existir al menos un administrador activo.
9. **AC-3.9** — **Dado** la lista de usuarios, **Cuando** el administrador la consulta,
   **Entonces** ve para cada usuario su nombre completo, nombre de usuario, rol y estado
   (activo/inactivo), y nunca ve las contraseñas.

---

### Edge Cases

- **Sesión en dispositivo compartido**: si un trabajador olvida cerrar sesión en una tablet
  compartida, la sesión expira sola después de 12 horas (duración aproximada de una jornada),
  y el siguiente trabajador debe iniciar sesión con su propia cuenta.
- **Usuario desactivado con sesión abierta**: su siguiente acción es rechazada y vuelve a la
  pantalla de ingreso (AC-3.6).
- **Rol cambiado con sesión abierta**: los permisos nuevos aplican en su siguiente acción
  (AC-2.4).
- **Administrador que se desactiva a sí mismo**: no está permitido; otro administrador debe
  hacerlo (además aplica la regla del último administrador, AC-3.8).
- **Nombre de usuario con espacios al inicio o al final**: se eliminan antes de guardar y al
  iniciar sesión.
- **Pérdida de conexión al iniciar sesión**: se muestra un mensaje en español indicando que no
  hay conexión y que se intente de nuevo; no se pierde lo escrito en el formulario.
- **Primer uso del sistema**: debe existir un administrador inicial creado durante la
  instalación para poder registrar al resto del personal.

## Requirements *(mandatory)*

### Functional Requirements

**Inicio y cierre de sesión**

- **FR-001**: El sistema MUST permitir iniciar sesión con nombre de usuario y contraseña.
- **FR-002**: Ante credenciales incorrectas, el sistema MUST mostrar un único mensaje genérico
  que no revele si el usuario existe.
- **FR-003**: El sistema MUST bloquear temporalmente durante 15 minutos el ingreso a una
  cuenta tras 5 intentos fallidos consecutivos.
- **FR-004**: El sistema MUST impedir el ingreso de usuarios desactivados.
- **FR-005**: Tras iniciar sesión, el sistema MUST llevar al usuario a la pantalla inicial de
  su rol.
- **FR-006**: El usuario MUST poder cerrar sesión desde cualquier pantalla interna.
- **FR-007**: Las sesiones MUST expirar automáticamente 12 horas después de iniciadas.
- **FR-008**: El sistema MUST redirigir a la pantalla de ingreso a quien intente acceder a una
  pantalla interna sin sesión válida.

**Roles y permisos**

- **FR-009**: El sistema MUST manejar exactamente cuatro roles: administrador, mozo, cocina y
  cajero. Cada usuario MUST tener exactamente un rol; quien cubra dos funciones usa una cuenta
  por función.
- **FR-010**: El sistema MUST mostrar a los usuarios de rol mozo, cocina o cajero solo las
  pantallas y opciones de menú de su rol, y MUST rechazar tanto el acceso a pantallas como la
  ejecución de operaciones de otros roles, aunque se intenten sin usar la interfaz.
- **FR-011**: El administrador MUST tener acceso a la gestión de usuarios y, además, a todas
  las pantallas y operaciones de mozo, cocina y cajero, con las mismas capacidades que esos
  roles. La gestión de usuarios MUST ser exclusiva del administrador.
- **FR-012**: Los cambios de rol o de estado de un usuario MUST aplicarse en su siguiente
  acción, sin esperar a que vuelva a iniciar sesión.

**Gestión de usuarios (solo administrador)**

- **FR-013**: El administrador MUST poder registrar usuarios con nombre completo, nombre de
  usuario, contraseña inicial y rol.
- **FR-014**: Los nombres de usuario MUST ser únicos sin distinguir mayúsculas de minúsculas.
- **FR-015**: Las contraseñas MUST tener al menos 8 caracteres.
- **FR-016**: El administrador MUST poder editar el nombre completo y el rol de un usuario.
- **FR-017**: El administrador MUST poder asignar una contraseña nueva a cualquier usuario.
- **FR-018**: El administrador MUST poder desactivar y reactivar usuarios; los usuarios no se
  eliminan, para conservar el historial de quién hizo cada operación.
- **FR-019**: El sistema MUST garantizar que siempre exista al menos un administrador activo,
  y MUST impedir que un administrador se desactive a sí mismo.
- **FR-020**: La lista de usuarios MUST mostrar nombre completo, nombre de usuario, rol y
  estado de cada usuario.
- **FR-021**: El sistema MUST NOT mostrar ni permitir recuperar las contraseñas de los
  usuarios; solo pueden reemplazarse.
- **FR-022**: Las acciones destructivas (desactivar un usuario) MUST pedir confirmación.

**Interfaz**

- **FR-023**: Todos los textos, mensajes de error y confirmaciones MUST estar en español.
- **FR-024**: La pantalla de ingreso y las pantallas iniciales de mozo y cocina MUST poder
  usarse cómodamente en tablet, en orientación vertical y horizontal.

### Key Entities

- **Usuario**: persona del personal que usa el sistema. Atributos: nombre completo, nombre de
  usuario (único), contraseña (nunca visible), rol, estado (activo/inactivo), fecha de
  registro, intentos fallidos recientes y fin del bloqueo temporal si lo hay.
- **Rol**: función del usuario en la picantería (administrador, mozo, cocina o cajero). Define
  qué pantallas y operaciones están permitidas.
- **Sesión**: periodo en que un usuario ha iniciado sesión en un dispositivo. Atributos:
  usuario, momento de inicio, momento de expiración, estado (vigente/cerrada/expirada).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un trabajador con sus credenciales a mano puede iniciar sesión y llegar a la
  pantalla de su función en menos de 15 segundos.
- **SC-002**: El 100 % de los intentos de un mozo, cocinero o cajero de abrir pantallas u
  operaciones de otro rol son rechazados, y el 100 % de los accesos del administrador a
  cualquier pantalla son permitidos, verificado para cada combinación de rol y pantalla en las
  pruebas de aceptación.
- **SC-003**: Un administrador puede registrar un usuario nuevo con su rol en menos de
  1 minuto.
- **SC-004**: Al menos el 90 % del personal inicia sesión correctamente en el primer intento
  tras una explicación inicial de menos de 2 minutos.
- **SC-005**: Un usuario desactivado pierde el acceso inmediatamente: su siguiente acción tras
  la desactivación es rechazada en el 100 % de los casos.
- **SC-006**: La pantalla de ingreso y las pantallas iniciales de mozo y cocina se usan en
  tablet sin desplazamiento horizontal en ambas orientaciones.

## Assumptions

- El sistema lo usa solo el personal de la picantería; los clientes no tienen cuentas.
- Las pantallas propias de cada función (toma de pedidos, cocina, caja) se especifican en
  features posteriores; esta feature entrega una pantalla inicial por rol y la regla de acceso
  que esas features usarán.
- El personal no necesariamente tiene correo electrónico, por eso no hay recuperación de
  contraseña por correo: la restablece el administrador.
- Los usuarios no cambian su propia contraseña en esta versión; lo hace el administrador.
- Varias personas pueden compartir una misma tablet en distintos momentos, pero cada una
  inicia sesión con su propia cuenta.
- Un mismo usuario puede tener sesiones abiertas en más de un dispositivo a la vez.
- El administrador inicial se crea durante la instalación del sistema.
- La duración de sesión (12 horas), el bloqueo (5 intentos, 15 minutos) y la longitud mínima
  de contraseña (8 caracteres) son valores razonables por defecto para un restaurante pequeño.
