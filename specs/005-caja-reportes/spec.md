# Feature Specification: Caja y reportes

**Feature Branch**: `005-caja-reportes`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Módulo Caja y reportes de Picantería Digital: cuenta de la mesa, división de cuenta, método de pago (efectivo, Yape/Plin, tarjeta), cierre del día, reportes de ventas y platos más vendidos. Roles: el Cajero cobra, registra el método de pago y hace el cierre del día; el Administrador (dueño) ve los reportes (y, como en la base común, puede usar todas las pantallas); el Mozo pide la cuenta en el módulo de mesas y pedidos (003), que pasa la mesa a "por cobrar". Reglas de negocio: una mesa no se libera hasta que su cuenta esté pagada (la libera Caja al cobrar); el cierre del día compara lo cobrado por método de pago con lo registrado en el sistema; si una mesa "por cobrar" pide algo más, vuelve a "ocupada" y después el mozo pide la cuenta otra vez; los ítems anulados no se cobran. Fuera de alcance: delivery, facturación electrónica con SUNAT, inventario de insumos y pagos en línea."

## Clarifications

### Session 2026-10-29

- Q: ¿Cómo se divide la cuenta? → A: Ambas opciones: en partes iguales o por ítems (AC-2.1,
  AC-2.2, FR-011).
- Q: ¿Qué pasa si hay mesas ocupadas o por cobrar al hacer el cierre? → A: Se impide el cierre
  hasta que todas las mesas estén libres (AC-3.5, FR-020).

## User Scenarios & Testing *(mandatory)*

> Cada escenario de aceptación tiene un identificador `AC-<historia>.<n>`. Según el Principio II
> de la constitución, cada uno MUST tener al menos una prueba automatizada cuyo título empiece
> con `[005] AC-<historia>.<n>`.

### User Story 1 - Cobrar la cuenta completa de una mesa (Priority: P1)

Cuando el mozo pide la cuenta, la mesa aparece en la pantalla de caja como "por cobrar". El
cajero abre la cuenta, ve el detalle del consumo y el total, registra el pago con el método que
usa el cliente (efectivo, Yape/Plin o tarjeta) y la mesa queda libre para recibir nuevos
clientes.

**Why this priority**: es el paso que cierra la atención de cada mesa y libera las mesas para
seguir vendiendo. Sin él, ninguna mesa vuelve a estar libre y no hay ventas registradas que
cuadrar ni reportar.

**Independent Test**: con una mesa por cobrar que tiene ítems enviados (algunos anulados), el
cajero cobra el total con cada método de pago y se comprueba que el total excluye lo anulado,
que el vuelto en efectivo es correcto y que la mesa pasa a libre para todos.

**Acceptance Scenarios**:

1. **AC-1.1** — **Dado** que un mozo pide la cuenta de una mesa, **Cuando** el cajero tiene
   abierta la pantalla de caja, **Entonces** la mesa aparece en la lista de mesas por cobrar,
   con su número, su mozo responsable y su total, sin recargar la pantalla.
2. **AC-1.2** — **Dado** una mesa por cobrar, **Cuando** el cajero abre su cuenta, **Entonces**
   ve cada ítem enviado con su cantidad no anulada, precio unitario y subtotal, las unidades
   anuladas marcadas como "Anulado" sin sumar, y el total en soles.
3. **AC-1.3** — **Dado** la cuenta de una mesa por cobrar, **Cuando** el cajero registra un pago
   en efectivo por el total indicando el monto recibido, **Entonces** el sistema muestra el
   vuelto, marca la cuenta como pagada y la mesa pasa a libre para todos los mozos y cajeros
   sin recargar.
4. **AC-1.4** — **Dado** la cuenta de una mesa por cobrar, **Cuando** el cajero registra el pago
   del total con Yape/Plin o con tarjeta, **Entonces** la cuenta queda pagada con ese método y
   la mesa pasa a libre.
5. **AC-1.5** — **Dado** un pago en efectivo, **Cuando** el monto recibido es menor que el monto
   a cobrar, **Entonces** el sistema no registra el pago e indica que el monto recibido no
   alcanza.
6. **AC-1.6** — **Dado** una mesa ocupada (sin cuenta pedida) o libre, **Cuando** el cajero
   intenta registrar un pago para ella, **Entonces** el sistema no lo permite e indica que el
   mozo debe pedir la cuenta primero.
7. **AC-1.7** — **Dado** que el cajero tiene abierta la cuenta de una mesa por cobrar, **Cuando**
   un mozo agrega algo a esa mesa y la mesa vuelve a ocupada, **Entonces** la pantalla de caja
   lo muestra sin recargar y no permite registrar pagos hasta que el mozo vuelva a pedir la
   cuenta.
8. **AC-1.8** — **Dado** un usuario con rol mozo o cocina, **Cuando** intenta abrir la pantalla
   de caja o registrar un pago, **Entonces** el sistema lo rechaza con el mensaje de permiso.

---

### User Story 2 - Dividir la cuenta entre varios clientes (Priority: P2)

Cuando los clientes de una mesa quieren pagar por separado, el cajero divide la cuenta y
registra un pago por cada parte, cada uno con su propio método de pago. La mesa solo se libera
cuando se completa el total.

**Why this priority**: en una picantería es habitual que una mesa pague por partes y con
métodos distintos (uno en efectivo, otro con Yape). Sin esto el cajero tendría que hacer las
cuentas a mano y registrar un solo pago incorrecto. Depende del cobro (P1).

**Independent Test**: con una mesa por cobrar, el cajero divide la cuenta, registra pagos de
distintas partes con métodos distintos y se comprueba que la mesa sigue por cobrar mientras
quede saldo y se libera al completar el total.

**Acceptance Scenarios**:

1. **AC-2.1** — **Dado** la cuenta de una mesa por cobrar, **Cuando** el cajero la divide en
   partes iguales indicando la cantidad de personas, **Entonces** el sistema muestra el monto de
   cada parte, los céntimos sobrantes se suman a la primera parte y la suma de las partes es
   exactamente el total pendiente.
2. **AC-2.2** — **Dado** la cuenta de una mesa por cobrar, **Cuando** el cajero la divide por
   ítems asignando cada ítem (o algunas de sus unidades) a una parte, **Entonces** cada parte
   muestra los ítems asignados y su monto, y el sistema no permite confirmar la división
   mientras queden unidades sin asignar.
3. **AC-2.3** — **Dado** una cuenta dividida, **Cuando** el cajero registra el pago de una
   parte con un método, **Entonces** esa parte queda pagada, el saldo pendiente se actualiza y
   la mesa sigue por cobrar.
4. **AC-2.4** — **Dado** una cuenta dividida con varias partes pagadas con métodos distintos,
   **Cuando** el cajero registra el pago de la última parte, **Entonces** la cuenta queda pagada
   y la mesa pasa a libre.
5. **AC-2.5** — **Dado** una cuenta con pagos parciales registrados, **Cuando** el cajero intenta
   registrar un pago mayor que el saldo pendiente con Yape/Plin o tarjeta, **Entonces** el
   sistema no lo registra e indica el saldo pendiente.
6. **AC-2.6** — **Dado** una cuenta con pagos parciales y una mesa que vuelve a ocupada porque
   pidieron algo más, **Cuando** el mozo vuelve a pedir la cuenta, **Entonces** los pagos ya
   registrados se conservan y el saldo pendiente incluye lo agregado.
7. **AC-2.7** — **Dado** un pago parcial registrado por error en una cuenta que todavía no está
   pagada por completo, **Cuando** el cajero lo anula indicando el motivo y confirma, **Entonces**
   el pago deja de contar para el saldo y para el cierre, y queda registrado como anulado con su
   motivo.

---

### User Story 3 - Hacer el cierre del día (Priority: P2)

Al terminar la jornada, el cajero cuenta el dinero que tiene por cada método de pago (el
efectivo de la caja, los Yape/Plin recibidos y los vouchers de tarjeta) y lo registra. El
sistema lo compara con lo que se registró en el sistema durante la jornada y muestra las
diferencias, que quedan guardadas con el cierre.

**Why this priority**: permite cuadrar la caja todos los días, uno de los problemas que motivan
el proyecto. Depende de que existan cobros (P1).

**Independent Test**: tras registrar cobros con los tres métodos, el cajero hace el cierre
ingresando montos contados, uno de ellos distinto de lo registrado, y se comprueba que el
sistema muestra la diferencia correcta por método y que el cierre queda guardado.

**Acceptance Scenarios**:

1. **AC-3.1** — **Dado** cobros registrados desde el último cierre, **Cuando** el cajero inicia
   el cierre del día, **Entonces** el sistema le pide el monto contado de efectivo, de Yape/Plin
   y de tarjeta antes de mostrarle lo registrado en el sistema.
2. **AC-3.2** — **Dado** los montos contados ingresados, **Cuando** el cajero los envía,
   **Entonces** el sistema muestra por cada método el monto registrado, el contado y la
   diferencia (sobrante o faltante), además del total del día y la cantidad de cuentas cobradas.
3. **AC-3.3** — **Dado** que algún método tiene diferencia distinta de cero, **Cuando** el cajero
   confirma el cierre, **Entonces** el sistema le exige una observación que explique la
   diferencia antes de guardarlo.
4. **AC-3.4** — **Dado** un cierre confirmado, **Cuando** se registran cobros después,
   **Entonces** esos cobros pertenecen a la siguiente jornada y no modifican el cierre guardado.
5. **AC-3.5** — **Dado** que hay mesas ocupadas o por cobrar, **Cuando** el cajero intenta hacer
   el cierre, **Entonces** el sistema no lo permite y muestra qué mesas siguen abiertas; el
   cierre solo es posible cuando todas las mesas están libres.
6. **AC-3.6** — **Dado** cierres anteriores, **Cuando** el cajero o el administrador consultan
   el historial de cierres, **Entonces** ven para cada uno la fecha, el cajero, los montos
   registrados y contados por método, las diferencias y la observación.

---

### User Story 4 - Ver los reportes de ventas (Priority: P3)

El administrador consulta cuánto se vendió en un rango de fechas: el total vendido, la cantidad
de cuentas cobradas, el ticket promedio y el detalle por día y por método de pago.

**Why this priority**: da al dueño la visión del negocio, pero el local puede operar sin ella.
Depende de que existan cobros (P1).

**Independent Test**: con cobros registrados en distintos días y métodos, el administrador
consulta un rango y se comprueba que los totales coinciden con la suma de los pagos no anulados
de ese rango.

**Acceptance Scenarios**:

1. **AC-4.1** — **Dado** cobros en varios días, **Cuando** el administrador consulta las ventas
   de un rango de fechas, **Entonces** ve el total vendido, la cantidad de cuentas cobradas y el
   ticket promedio del rango.
2. **AC-4.2** — **Dado** el mismo rango, **Cuando** el administrador ve el detalle, **Entonces**
   ve el total por día y el total por método de pago (efectivo, Yape/Plin, tarjeta).
3. **AC-4.3** — **Dado** pagos anulados en el rango, **Cuando** el administrador consulta las
   ventas, **Entonces** esos pagos no suman en ningún total.
4. **AC-4.4** — **Dado** un rango sin cobros, **Cuando** el administrador lo consulta,
   **Entonces** ve totales en cero y el mensaje "No hay ventas en este rango".
5. **AC-4.5** — **Dado** un usuario con rol cajero, mozo o cocina, **Cuando** intenta abrir los
   reportes, **Entonces** el sistema lo rechaza con el mensaje de permiso.

---

### User Story 5 - Ver los platos más vendidos (Priority: P3)

El administrador consulta qué platos se vendieron más en un rango de fechas, por unidades y por
monto, para decidir qué promocionar o retirar de la carta.

**Why this priority**: es información de gestión útil pero no necesaria para operar. Depende de
que existan cobros (P1).

**Independent Test**: con cuentas cobradas que incluyen distintos platos (y algunas unidades
anuladas), el administrador consulta el ranking y se comprueba el orden y que las unidades
anuladas no cuentan.

**Acceptance Scenarios**:

1. **AC-5.1** — **Dado** cuentas cobradas en un rango, **Cuando** el administrador consulta los
   platos más vendidos, **Entonces** ve un ranking con cada plato, las unidades vendidas y el
   monto vendido, ordenado de mayor a menor por unidades.
2. **AC-5.2** — **Dado** el ranking, **Cuando** el administrador elige ordenar por monto,
   **Entonces** el orden cambia a mayor a menor por monto vendido.
3. **AC-5.3** — **Dado** ítems con unidades anuladas, **Cuando** se calcula el ranking,
   **Entonces** solo cuentan las unidades no anuladas de cuentas pagadas.
4. **AC-5.4** — **Dado** un plato cuyo precio cambió en la carta dentro del rango, **Cuando** se
   calcula su monto vendido, **Entonces** se usa el precio con el que se envió cada ítem, no el
   precio actual.

---

### Edge Cases

- **Cuenta con todo anulado**: si todos los ítems de una mesa por cobrar fueron anulados, el
  total es S/ 0.00; el cajero la cierra sin registrar pago ("Cerrar sin cobro") y la mesa queda
  libre. Esa cuenta no suma ventas.
- **Redondeo al dividir en partes iguales**: si el total no se divide exacto, los céntimos
  sobrantes se suman a la primera parte, de modo que la suma siempre es el total.
- **Rehacer la división**: mientras no haya pagos, el cajero puede cambiar el modo o rehacer la
  división. Con pagos registrados, solo puede dividir el saldo pendiente: en partes iguales, o
  por ítems asignando solo las unidades que aún no se pagaron.
- **Ítems agregados después de dividir por ítems**: si la mesa vuelve a ocupada y luego se pide
  la cuenta otra vez, las unidades nuevas quedan sin asignar y el cajero debe asignarlas antes
  de cobrar.
- **Dos cajeros cobran la misma mesa a la vez**: se aplica el primer pago; el segundo ve el
  saldo actualizado y no puede cobrar más del saldo pendiente.
- **Mesa que vuelve a ocupada con la cuenta abierta en caja**: la pantalla de caja se actualiza
  y bloquea el cobro hasta que el mozo vuelva a pedir la cuenta (AC-1.7).
- **Pérdida de conexión en caja**: la pantalla muestra un aviso; al recuperar la conexión,
  muestra el estado actual de las mesas y saldos sin duplicar pagos.
- **Cuenta ya pagada**: una cuenta pagada no se puede modificar ni volver a cobrar en esta
  versión.
- **Cierre sin cobros**: se permite; todos los montos registrados son cero.
- **Jornada que pasa de medianoche**: la jornada va desde el cierre anterior hasta el cierre
  actual, no por fecha de calendario.

## Requirements *(mandatory)*

### Functional Requirements

**Cuenta y cobro**

- **FR-001**: La pantalla de caja MUST listar las mesas por cobrar con su número, mozo
  responsable, total y saldo pendiente, y actualizarse sin recargar cuando una mesa pasa a por
  cobrar, vuelve a ocupada o se libera.
- **FR-002**: La cuenta de una mesa MUST mostrar los ítems enviados con cantidad no anulada,
  precio unitario (el vigente al enviarse) y subtotal; las unidades anuladas MUST mostrarse como
  anuladas y MUST NOT sumar al total.
- **FR-003**: El total de la cuenta MUST ser la suma de los subtotales de los ítems enviados no
  anulados, en soles con dos decimales.
- **FR-004**: El sistema MUST permitir registrar pagos solo para mesas por cobrar.
- **FR-005**: Cada pago MUST registrar el monto, el método (efectivo, Yape/Plin o tarjeta), el
  cajero que lo registró y la fecha y hora. Para Yape/Plin y tarjeta MUST permitir una
  referencia opcional (número de operación o de voucher).
- **FR-006**: En efectivo, el sistema MUST pedir el monto recibido, rechazar montos menores que
  el monto a cobrar y mostrar el vuelto.
- **FR-007**: El monto de un pago MUST NOT superar el saldo pendiente de la cuenta.
- **FR-008**: Cuando la suma de pagos no anulados alcanza el total, la cuenta MUST quedar pagada
  y la mesa MUST pasar a libre para todos los usuarios sin recargar.
- **FR-009**: Una cuenta con total cero MUST poder cerrarse sin registrar pago, liberando la
  mesa.
- **FR-010**: Una cuenta pagada MUST NOT modificarse ni cobrarse de nuevo.

**División de cuenta**

- **FR-011**: El cajero MUST poder dividir la cuenta de una mesa por cobrar de dos formas: en
  partes iguales (indicando la cantidad de personas; los céntimos sobrantes van a la primera
  parte) o por ítems (asignando cada ítem o algunas de sus unidades a una parte, sin dejar
  unidades sin asignar). En ambos casos la suma de las partes MUST ser exactamente el saldo
  pendiente.
- **FR-012**: Cada parte MUST poder pagarse con un método distinto; la mesa MUST seguir por
  cobrar mientras quede saldo pendiente.
- **FR-013**: Si una mesa con pagos parciales vuelve a ocupada y se pide la cuenta de nuevo, los
  pagos registrados MUST conservarse y el saldo MUST incluir lo agregado.
- **FR-014**: Mientras una cuenta no esté pagada por completo, el cajero MUST poder anular un
  pago indicando un motivo y confirmando; el pago anulado MUST conservarse en el historial y
  MUST NOT contar para el saldo, el cierre ni los reportes.

**Cierre del día**

- **FR-015**: La jornada MUST abarcar desde el cierre anterior (o el primer cobro, si no hay
  cierres) hasta el cierre actual.
- **FR-016**: Al cerrar, el cajero MUST ingresar el monto contado de cada método antes de ver lo
  registrado en el sistema.
- **FR-017**: El sistema MUST mostrar por método el monto registrado (suma de pagos no anulados
  de la jornada), el contado y la diferencia, además del total de la jornada y la cantidad de
  cuentas cobradas.
- **FR-018**: Si alguna diferencia es distinta de cero, el sistema MUST exigir una observación
  para confirmar el cierre.
- **FR-019**: Un cierre confirmado MUST guardarse con el cajero, la fecha y hora y todos sus
  montos, y MUST NOT modificarse después.
- **FR-020**: El sistema MUST impedir el cierre mientras haya mesas ocupadas o por cobrar, e
  indicar cuáles son.
- **FR-021**: El cajero y el administrador MUST poder consultar el historial de cierres.

**Reportes (solo administrador)**

- **FR-022**: El administrador MUST poder consultar las ventas de un rango de fechas: total
  vendido, cantidad de cuentas cobradas, ticket promedio, total por día y total por método.
- **FR-023**: El administrador MUST poder consultar el ranking de platos más vendidos de un
  rango de fechas, por unidades o por monto, contando solo unidades no anuladas de cuentas
  pagadas y valorizadas al precio con que se enviaron.
- **FR-024**: Los reportes MUST excluir los pagos anulados y las cuentas cerradas sin cobro.
- **FR-025**: Los reportes MUST estar disponibles solo para el administrador.

**Acceso e interfaz**

- **FR-026**: La pantalla de caja MUST estar disponible para el cajero y el administrador;
  mozo y cocina MUST recibir el mensaje de permiso.
- **FR-027**: Los montos MUST mostrarse en soles con el formato `S/ 0.00` y las fechas en
  formato día/mes/año (Principio III).
- **FR-028**: Las acciones que liberan la mesa, anulan un pago o confirman el cierre MUST pedir
  confirmación.

### Key Entities

- **Cuenta de la mesa**: el consumo del pedido de una mesa por cobrar (ítems enviados, unidades
  anuladas, total) más sus pagos y su saldo pendiente. Se calcula a partir del pedido de la
  feature 003; su estado es pendiente o pagada.
- **Parte de la cuenta**: una porción de la cuenta a pagar por separado, con su monto (y, según
  el modo de división, los ítems asignados).
- **Pago**: monto, método (efectivo, Yape/Plin, tarjeta), referencia opcional, monto recibido y
  vuelto (en efectivo), cajero, fecha y hora, y estado (vigente o anulado, con motivo y quién lo
  anuló).
- **Cierre del día**: jornada (inicio y fin), cajero, por cada método el monto registrado, el
  contado y la diferencia, total de la jornada, cantidad de cuentas cobradas y observación.
- **Reporte de ventas** y **ranking de platos**: vistas calculadas a partir de pagos y cuentas
  pagadas; no se guardan.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un cajero cobra la cuenta completa de una mesa en menos de 1 minuto desde que la
  abre.
- **SC-002**: Un cajero divide una cuenta y registra los pagos de 4 personas con métodos
  distintos en menos de 3 minutos.
- **SC-003**: El cierre del día se completa en menos de 5 minutos una vez contado el dinero.
- **SC-004**: En el 100 % de los casos, el total registrado por método en el cierre coincide con
  la suma de los pagos no anulados de la jornada.
- **SC-005**: En el 100 % de los casos, el total de una cuenta coincide con la suma de los
  subtotales no anulados y ninguna unidad anulada se cobra ni aparece como vendida.
- **SC-006**: Una mesa cobrada aparece libre en las pantallas de los mozos en menos de 3
  segundos.
- **SC-007**: Los reportes de un rango de hasta un año se muestran en menos de 3 segundos.

## Assumptions

- **Dependencia de la 003 (mesas y pedidos)**: el pedido, sus ítems con precio fijado al enviar,
  las anulaciones parciales, el estado de mesa por cobrar y el evento de cambio de estado de la
  mesa los define y produce la 003. Al pedir la cuenta no quedan ítems sin enviar (003 AC-6.3).
  Caja marca el pedido como pagado y libera la mesa (003 AC-6.6).
- Las pruebas de extremo a extremo usan el flujo real de la 003 (tomar, enviar, anular y pedir
  la cuenta), disponible en `main` desde el PR #8; las pruebas de la API pueden preparar los
  pedidos directamente en la base de pruebas.
- Un solo local y una sola caja; puede haber más de un usuario cajero, pero comparten la misma
  jornada.
- No se emite comprobante impreso ni electrónico (fuera de alcance: SUNAT); la cuenta se muestra
  en pantalla.
- No se manejan descuentos, propinas ni recargos en esta versión.
- Yape/Plin se registra como un solo método; no se integra con ninguna billetera ni pasarela
  (pagos en línea fuera de alcance).
- El conteo del cierre es "a ciegas": el cajero ingresa lo contado antes de ver lo esperado,
  para no influir en el conteo.
- Los reportes usan la fecha y hora del pago (zona horaria de Perú) para ubicar las ventas en un
  día.
