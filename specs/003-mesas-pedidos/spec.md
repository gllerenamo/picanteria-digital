# Feature Specification: Mesas y pedidos (Módulo 2)

**Feature Branch**: `003-mesas-pedidos`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Módulo 2 «Mesas y pedidos» de Picantería Digital: reemplaza la libreta del mozo; desde su celular o tablet ve las mesas, toma el pedido y lo manda a cocina." El texto completo de la descripción original está a continuación.

<details>
<summary>Descripción original completa</summary>

Módulo 2 "Mesas y pedidos" de Picantería Digital, una aplicación web para una picantería pequeña de 8 a 15 mesas.

Problema: hoy el mozo anota los pedidos en papel. Se pierden comandas, la cocina no sabe qué va primero y al final del día cuesta cuadrar la caja. Este módulo reemplaza la libreta del mozo: desde su celular o tablet ve las mesas, toma el pedido y lo manda a cocina.

Usuarios:

- Mozo (usuario principal): abre mesas, toma pedidos, los envía a cocina, sigue su estado y pide la cuenta.
- Administrador: autoriza la anulación de ítems que ya se enviaron a cocina.
- Cocina y Caja no usan este módulo; reciben lo que sale de él (módulos 3 y 4).

Historias de usuario, por prioridad:

1. (P1) Como mozo, veo todas las mesas con su estado (libre, ocupada, por cobrar) y abro una mesa libre, que pasa a ocupada.
2. (P1) Como mozo, tomo el pedido de una mesa: elijo platos y bebidas disponibles de la carta, indico la cantidad y una nota por plato (por ejemplo "sin ají"), y antes de enviar puedo quitar o cambiar ítems.
3. (P1) Como mozo, envío a cocina lo tomado y aún no enviado; la cocina lo recibe con mesa, platos, cantidades y notas sin que nadie recargue la pantalla. Una mesa puede enviar varias rondas y cada envío lleva solo lo nuevo.
4. (P2) Como mozo, veo el estado de cada ítem enviado (pendiente, en preparación, listo) y recibo un aviso cuando un plato de mis mesas está listo para llevar.
5. (P2) Como administrador, anulo un ítem ya enviado indicando el motivo; la cocina se entera al instante y deja de prepararlo.
6. (P3) Como mozo, pido la cuenta de una mesa y la mesa pasa a "por cobrar".

Reglas de negocio:

- Un plato marcado como no disponible no aparece al tomar pedidos.
- Antes de enviarse, el mozo puede quitar o cambiar un ítem sin pedir permiso.
- Un ítem ya enviado a cocina solo se puede anular con autorización del administrador.
- Una mesa no se libera hasta que su cuenta esté pagada. La libera Caja al cobrar, no el mozo.

Casos borde a cubrir:

- Un plato se agota entre que el mozo lo agrega y lo envía.
- El mozo pulsa enviar sin ítems nuevos.
- La tablet del mozo pierde la conexión y luego la recupera.
- Dos mozos intentan abrir la misma mesa a la vez.
- Una mesa ya está por cobrar y piden algo más.

Supuestos (confírmalos o pregúntalos en la clarificación):

- El aviso de plato listo llega solo al mozo que abrió la mesa.
- Se puede anular un ítem pendiente o en preparación, no uno listo.
- El administrador anula desde su propia sesión.
- Por definir: si un mozo puede atender una mesa que abrió otro, si se agregan ítems a una mesa por cobrar y si se registra el número de comensales.

Fuera de alcance de este módulo: gestionar la carta y la disponibilidad de platos (módulo 1), la pantalla de cocina y el cambio de estados (módulo 3), el cobro, la división de cuenta y el cierre del día (módulo 4), y el login y los usuarios (base común). Fuera del proyecto: delivery, facturación electrónica, inventario y pagos en línea.

Entidades: Mesa, Pedido, Ítem del pedido y Envío a cocina.

Criterios de éxito:

- Nada de lo enviado a cocina se pierde, aunque una tablet se desconecte.
- La cocina recibe los envíos en el orden en que salieron.
- El mozo atiende toda la mesa sin usar papel, desde que la abre hasta que pide la cuenta.

</details>

## Clarifications

### Session 2026-10-28

- Q: ¿Puede un mozo tomar pedidos, enviarlos y pedir la cuenta en una mesa que abrió otro mozo? → A: Sí. Cualquier mozo puede atender cualquier mesa ocupada; el que la abrió sigue siendo el responsable y es el único que recibe los avisos de plato listo.
- Q: Si una mesa ya está por cobrar y los clientes piden algo más, ¿se puede agregar y enviar a cocina? → A: Sí. Al agregar algo, la mesa vuelve a ocupada (se deshace el pedido de cuenta) y al final el mozo pide la cuenta otra vez.
- Q: ¿Se registra cuántos comensales hay en la mesa al abrirla? → A: Sí, pero es opcional al abrir la mesa y se puede cambiar después.
- Q: Cuando hay que cancelar solo una parte de un ítem ya enviado (por ejemplo, 1 de 3 chichas), ¿el administrador puede anular solo esas unidades? → A: Sí. El administrador indica cuántas unidades anula (todas, por defecto) y el resto del ítem sigue su curso en cocina.
- Q: Si un mozo abre una mesa por error y todavía no envió nada a cocina, ¿quién puede devolverla a libre? → A: El mozo que la abrió puede cancelar la apertura mientras no se haya enviado nada; la mesa vuelve a libre.

## User Scenarios & Testing *(mandatory)*

Hoy el mozo anota los pedidos en una libreta: se pierden comandas, la cocina no sabe qué va
primero y al final del día cuesta cuadrar la caja. Este módulo reemplaza esa libreta. El mozo,
usuario principal, ve las mesas desde su tablet o celular, toma el pedido y lo manda a cocina.
El administrador interviene solo para anular lo que ya se envió. Cocina (módulo 3) y Caja
(módulo 4) no usan este módulo: reciben lo que sale de él.

En esta especificación, el **mozo responsable** de una mesa es el mozo que la abrió. Cualquier
mozo puede atender una mesa ocupada, pero el responsable no cambia.

Cada escenario de aceptación tiene un identificador (`AC-<historia>.<número>`) para que las
pruebas automatizadas lo referencien con el prefijo `[003] AC-x.y`, como exige el Principio II
de la constitución.

### User Story 1 - Ver las mesas y abrir una mesa libre (Priority: P1)

El mozo entra al módulo y ve todas las mesas del local con su estado: libre, ocupada o por
cobrar. Cuando llegan clientes, elige una mesa libre y la abre. Desde ese momento la mesa
figura como ocupada para todos los mozos y él queda como su responsable.

**Why this priority**: es la puerta de entrada de todo el flujo; sin una mesa abierta no hay
pedido que tomar ni enviar. Además, por sí sola ya da a los mozos una vista común de la sala,
que hoy llevan de memoria.

**Independent Test**: con las mesas del local cargadas y dos mozos con sesión iniciada, uno abre
una mesa libre y los dos la ven ocupada; luego el otro intenta abrir la misma mesa y no puede.
Entrega valor como tablero de ocupación aunque las demás historias no existan.

**Acceptance Scenarios**:

1. **AC-1.1**: **Dado** un mozo con sesión iniciada, **Cuando** entra al módulo, **Entonces** ve
   todas las mesas del local, cada una con su número y su estado (libre, ocupada o por cobrar),
   y en las que no están libres, su mozo responsable.
2. **AC-1.2**: **Dado** una mesa libre, **Cuando** el mozo la abre, **Entonces** la mesa pasa a
   ocupada, se registran el mozo que la abrió y la hora de apertura, y el mozo pasa directamente a
   tomar el pedido de esa mesa.
3. **AC-1.3**: **Dado** que un mozo abre una mesa, **Cuando** otro mozo tiene abierta la vista de
   mesas, **Entonces** ve la mesa como ocupada sin recargar la pantalla.
4. **AC-1.4**: **Dado** una mesa ocupada o por cobrar, **Cuando** un mozo intenta abrirla,
   **Entonces** el sistema no la abre de nuevo ni crea un segundo pedido para ella.
5. **AC-1.5**: **Dado** que dos mozos intentan abrir la misma mesa libre casi al mismo tiempo,
   **Cuando** ambos confirman, **Entonces** solo uno la abre y el otro recibe un mensaje que le
   indica qué mozo la abrió y ve la mesa como ocupada.
6. **AC-1.6**: **Dado** una mesa que el mozo abrió por error y de la que aún no se envió nada a
   cocina, **Cuando** ese mismo mozo cancela la apertura y confirma, **Entonces** la mesa vuelve
   a libre y su pedido se descarta.
7. **AC-1.7**: **Dado** una mesa libre, **Cuando** el mozo la abre sin indicar el número de
   comensales, **Entonces** la mesa se abre igual; y **Cuando** después un mozo indica o cambia
   ese número, **Entonces** el pedido lo registra.
8. **AC-1.8**: **Dado** una mesa sin nada enviado a cocina que abrió otro mozo, **Cuando** un
   mozo que no es su responsable intenta cancelar la apertura, **Entonces** el sistema no lo
   permite.

---

### User Story 2 - Tomar el pedido de una mesa (Priority: P1)

Con la mesa abierta, el mozo arma el pedido: elige de la carta los platos y bebidas
disponibles, indica la cantidad y, si el cliente lo pide, una nota para ese plato (por ejemplo,
"sin ají"). Mientras no lo envíe, puede quitar ítems o cambiar su cantidad o su nota sin pedir
permiso a nadie.

**Why this priority**: es lo que reemplaza la libreta. Sin pedido tomado no hay nada que enviar
a cocina ni que cobrar.

**Independent Test**: se abre una mesa y se arma un pedido con platos y bebidas de la carta,
con notas, cambios de cantidad y un ítem quitado. El resultado es un pedido por enviar completo y
correcto, que se puede revisar aunque la cocina no esté conectada.

**Acceptance Scenarios**:

1. **AC-2.1**: **Dado** una mesa ocupada, **Cuando** el mozo abre la carta para tomar el pedido,
   **Entonces** ve solo los platos y bebidas marcados como disponibles, con su nombre y su precio
   en soles.
2. **AC-2.2**: **Dado** un plato que la carta marca como no disponible, **Cuando** el mozo toma
   un pedido, **Entonces** ese plato no aparece entre las opciones.
3. **AC-2.3**: **Dado** la carta disponible, **Cuando** el mozo agrega un plato con cantidad 2 y
   la nota "sin ají", **Entonces** el ítem aparece en el pedido de la mesa como no enviado, con
   esa cantidad y esa nota.
4. **AC-2.4**: **Dado** un plato ya agregado, **Cuando** el mozo agrega el mismo plato con otra
   nota, **Entonces** quedan como dos ítems distintos, cada uno con su cantidad y su nota.
5. **AC-2.5**: **Dado** un ítem aún no enviado, **Cuando** el mozo cambia su cantidad o su nota,
   **Entonces** el cambio se aplica de inmediato sin pedir autorización.
6. **AC-2.6**: **Dado** un ítem aún no enviado, **Cuando** el mozo lo quita y confirma,
   **Entonces** el ítem desaparece del pedido sin pedir autorización y la cocina no recibe nada.
7. **AC-2.7**: **Dado** una mesa con ítems no enviados, **Cuando** el mozo pasa a atender otra
   mesa y luego vuelve, **Entonces** encuentra los ítems tal como los dejó.

---

### User Story 3 - Enviar el pedido a cocina por rondas (Priority: P1)

El mozo envía a cocina lo que tomó y aún no envió. La cocina recibe el envío con el número de
mesa, los platos, las cantidades y las notas sin que nadie recargue su pantalla. Durante la
comida la mesa puede pedir más: cada envío nuevo lleva solo lo nuevo y nunca repite lo ya
enviado.

**Why this priority**: es el objetivo del módulo: que ninguna comanda se pierda y que la cocina
sepa qué va primero. Junto con las historias 1 y 2 forma el producto mínimo.

**Independent Test**: se envían dos rondas de una mesa y una de otra, y se revisa lo que recibe
la cocina (su pantalla o, si el módulo 3 aún no existe, el registro de envíos): cada envío trae
mesa, platos, cantidades y notas, solo lo nuevo, y en el orden en que salió.

**Acceptance Scenarios**:

1. **AC-3.1**: **Dado** una mesa con ítems no enviados, **Cuando** el mozo pulsa enviar,
   **Entonces** se registra un envío con la mesa, el mozo, la fecha y hora y esos ítems con sus
   cantidades y notas; los ítems pasan a "pendiente" y el mozo ve la confirmación del envío.
2. **AC-3.2**: **Dado** un envío confirmado, **Cuando** la cocina tiene abierta su pantalla,
   **Entonces** el envío aparece en ella sin que nadie recargue.
3. **AC-3.3**: **Dado** una mesa con una ronda ya enviada, **Cuando** el mozo agrega dos platos
   más y envía, **Entonces** el segundo envío contiene solo esos dos platos.
4. **AC-3.4**: **Dado** una mesa sin ítems no enviados, **Cuando** el mozo pulsa enviar,
   **Entonces** no se registra ningún envío, la cocina no recibe nada y el mozo ve un mensaje de
   que no hay nada nuevo que enviar.
5. **AC-3.5**: **Dado** que el mozo agregó un plato que se agotó antes de enviarlo, **Cuando**
   pulsa enviar, **Entonces** no se envía nada, el sistema le indica qué ítems ya no están
   disponibles y le permite quitarlos o cambiarlos y volver a enviar.
6. **AC-3.6**: **Dado** varios envíos de distintas mesas y mozos, **Cuando** llegan a la cocina,
   **Entonces** aparecen en el orden en que se confirmaron, cada uno con su número de orden y su
   hora.
7. **AC-3.7**: **Dado** un ítem ya enviado, **Cuando** el mozo revisa el pedido, **Entonces** no
   puede quitarlo ni cambiarlo por su cuenta; solo puede anularse con autorización del
   administrador (Historia 5).
8. **AC-3.8**: **Dado** que la tablet del mozo no tiene conexión, **Cuando** pulsa enviar,
   **Entonces** el sistema le muestra que el envío no se realizó, los ítems siguen como no
   enviados y puede volver a intentarlo cuando regrese la conexión.
9. **AC-3.9**: **Dado** que la conexión se cortó mientras se enviaba y el mozo no supo si el
   envío salió, **Cuando** recupera la conexión y vuelve a intentarlo, **Entonces** la cocina
   recibe ese envío una sola vez: ni se pierde ni se duplica.
10. **AC-3.10**: **Dado** una mesa ocupada que abrió otro mozo, **Cuando** un mozo toma ítems en
    ella y los envía, **Entonces** el sistema lo permite, el envío registra al mozo que lo envió y
    la mesa conserva a su mozo responsable.

---

### User Story 4 - Seguir lo enviado y recibir avisos de platos listos (Priority: P2)

Desde la mesa, el mozo ve en qué estado está cada ítem enviado: pendiente, en preparación o
listo. Cuando la cocina marca listo un plato de una de sus mesas, recibe un aviso para ir a
recogerlo, esté en la pantalla que esté.

**Why this priority**: evita idas y vueltas a cocina para preguntar y que los platos se enfríen
esperando. Es P2 porque el flujo básico funciona sin ella: el mozo todavía puede ir a mirar.

**Independent Test**: se envía un pedido y se cambian los estados de sus ítems desde la cocina
(o con un sustituto si el módulo 3 aún no existe). El mozo ve cada cambio de estado sin
recargar.

**Acceptance Scenarios**:

1. **AC-4.1**: **Dado** una mesa con ítems enviados, **Cuando** el mozo abre su pedido,
   **Entonces** ve cada ítem enviado con su estado actual (pendiente, en preparación, listo o
   anulado), separado de los ítems aún no enviados.
2. **AC-4.2**: **Dado** un ítem pendiente, **Cuando** la cocina lo pasa a en preparación,
   **Entonces** el mozo ve el cambio sin recargar la pantalla.

Los avisos de plato listo (FR-027) los implementa y prueba `004-cocina`: llegan al mozo
responsable con la mesa, el plato y la cantidad (004 AC-3.1), solo a él aunque otro mozo haya
enviado el ítem (004 AC-3.5), y los pendientes aparecen al volver a abrir la aplicación
(004 AC-3.3).

---

### User Story 5 - Anular un ítem ya enviado con autorización (Priority: P2)

Si el cliente cancela un plato que ya se envió a cocina, o el mozo se equivocó, el
administrador lo anula desde su propia sesión indicando el motivo. Puede anular el ítem completo
o solo algunas de sus unidades. La cocina se entera al instante y deja de preparar lo anulado, y
lo anulado no se cobra.

**Why this priority**: controla las anulaciones, una de las razones por las que la caja no cuadra,
y evita preparar platos que nadie paga. Es P2 porque el flujo básico funciona sin ella, aunque
entonces las correcciones quedan fuera del sistema.

**Independent Test**: se envía un ítem y un usuario administrador lo anula con un motivo. La
cocina lo ve anulado, el mozo lo ve anulado en el pedido de la mesa y el ítem no suma al
consumo.

**Acceptance Scenarios**:

1. **AC-5.1**: **Dado** un ítem enviado en estado pendiente o en preparación, **Cuando** el
   administrador lo anula indicando un motivo y confirma, **Entonces** el ítem pasa a anulado y
   quedan registrados quién lo anuló, cuándo y por qué.
2. **AC-5.2**: **Dado** un ítem recién anulado, **Cuando** la cocina tiene abierta su pantalla,
   **Entonces** ve que ese ítem de esa mesa fue anulado, sin que nadie recargue.
3. **AC-5.3**: **Dado** que el administrador intenta anular un ítem sin indicar el motivo,
   **Cuando** confirma, **Entonces** el sistema no lo anula y le pide el motivo.
4. **AC-5.4**: **Dado** un ítem en estado listo, **Cuando** el administrador intenta anularlo,
   **Entonces** el sistema no lo permite y le explica que el plato ya está listo.
5. **AC-5.5**: **Dado** un usuario sin rol de administrador, **Cuando** intenta anular un ítem
   ya enviado, **Entonces** el sistema no se lo permite.
6. **AC-5.6**: **Dado** un ítem anulado, **Cuando** el mozo o Caja consultan el consumo de la
   mesa, **Entonces** el ítem aparece como anulado y no suma al total.
7. **AC-5.7**: **Dado** un ítem enviado de 3 unidades en estado pendiente o en preparación,
   **Cuando** el administrador anula 1 unidad indicando el motivo y confirma, **Entonces** la
   cocina ve que ahora debe preparar 2, el ítem sigue su curso con 2 unidades y el consumo de la
   mesa suma solo esas 2.

---

### User Story 6 - Pedir la cuenta (Priority: P3)

Cuando los clientes piden la cuenta, el mozo la solicita desde la mesa y esta pasa a "por
cobrar". Caja (módulo 4) recibe la mesa con su consumo. La mesa sigue por cobrar hasta que Caja
cobra; recién entonces vuelve a estar libre. Si antes de pagar los clientes piden algo más, la
mesa vuelve a ocupada y el mozo pide la cuenta otra vez al terminar.

**Why this priority**: cierra el ciclo sin papel. Es P3 porque, mientras no exista, el mozo
puede avisar a caja de palabra; el riesgo de perder comandas está en el pedido, no en este paso.

**Independent Test**: se pide la cuenta de una mesa con ítems enviados. La mesa pasa a por
cobrar para todos los mozos, su consumo queda disponible para Caja (o para un sustituto si el
módulo 4 aún no existe) y ningún mozo puede liberarla.

**Acceptance Scenarios**:

1. **AC-6.1**: **Dado** una mesa ocupada con ítems enviados y ninguno por enviar, **Cuando** el
   mozo pide la cuenta y confirma, **Entonces** la mesa pasa a por cobrar y todos los mozos lo
   ven sin recargar la pantalla.
2. **AC-6.2**: **Dado** una mesa ocupada o por cobrar, **Cuando** el mozo consulta su consumo,
   **Entonces** ve los ítems enviados con su cantidad no anulada, precio unitario y subtotal, y
   el total en soles.
3. **AC-6.3**: **Dado** una mesa con ítems tomados y no enviados, **Cuando** el mozo pide la
   cuenta, **Entonces** el sistema le avisa y le pide enviarlos o quitarlos antes.
4. **AC-6.4**: **Dado** una mesa ocupada sin ningún ítem enviado, **Cuando** el mozo intenta
   pedir la cuenta, **Entonces** el sistema no lo permite e indica que la mesa no tiene consumo.
5. **AC-6.5**: **Dado** una mesa por cobrar, **Cuando** un mozo la ve, **Entonces** no tiene
   ninguna acción para liberarla: solo Caja la libera al cobrar.
6. **AC-6.6**: **Dado** una mesa por cobrar, **Cuando** Caja registra el cobro, **Entonces** la
   mesa aparece libre para todos los mozos, sin recargar, y lista para una nueva atención.
7. **AC-6.7**: **Dado** una mesa por cobrar, **Cuando** un mozo agrega un ítem y confirma que la
   mesa vuelve a ocupada, **Entonces** la mesa pasa a ocupada para todos, deja de figurar por
   cobrar para Caja y, para cobrarla, un mozo tiene que pedir la cuenta otra vez.

---

### Edge Cases

- **Un plato se agota entre que el mozo lo agrega y lo envía**: al enviar no sale nada; el
  sistema indica qué ítems ya no están disponibles y el mozo los quita o cambia y vuelve a
  enviar (AC-3.5). Si el mozo tiene el pedido a la vista cuando el plato se agota, el ítem se
  muestra marcado como no disponible antes de que pulse enviar.
- **El mozo pulsa enviar sin ítems nuevos**: no se registra ningún envío y la cocina no recibe
  un envío vacío (AC-3.4).
- **La tablet del mozo pierde la conexión y luego la recupera**:
  - El mozo ve claramente que está sin conexión.
  - Lo tomado y aún no enviado no se pierde.
  - Un envío solo se muestra como enviado cuando el sistema lo registró; si no hay
    confirmación, los ítems siguen como no enviados para reintentar (AC-3.8), y reintentar
    no duplica el envío (AC-3.9).
  - Al reconectarse, el mozo ve el estado real de las mesas y de los ítems, incluidos los
    cambios que hicieron otros mozos, la cocina o Caja mientras estuvo desconectado, y recibe
    los avisos de platos listos que no le llegaron (004 AC-3.3).
  - Si mientras estuvo desconectado algún plato de su pedido por enviar se agotó, al reintentar
    se aplica la misma regla de plato agotado.
- **Dos mozos intentan abrir la misma mesa a la vez**: solo uno la abre; el otro recibe un
  mensaje y nunca quedan dos pedidos para la misma mesa (AC-1.5).
- **Dos mozos toman pedido en la misma mesa a la vez**: los ítems por enviar son de la mesa, no
  de cada mozo. Ambos los ven y el envío, lo haga quien lo haga, lleva todos los no enviados una
  sola vez.
- **Una mesa ya está por cobrar y piden algo más**: el mozo agrega lo nuevo, la mesa vuelve a
  ocupada y al final se pide la cuenta otra vez (AC-6.7). Si Caja ya registró el cobro, la mesa
  está libre y lo nuevo se pide en una atención nueva; si la mesa ya volvió a ocupada, Caja no
  puede cobrarla hasta que se pida la cuenta otra vez.
- **Mesa abierta por error**: si aún no se envió nada, el mozo que la abrió cancela la apertura
  y la mesa vuelve a libre (AC-1.6); ningún otro mozo puede hacerlo (AC-1.8). Si ya hay algo enviado, la mesa solo se libera al cobrar; lo enviado
  por error se anula con autorización del administrador.
- **Un plato se agota después de enviado**: no afecta lo ya enviado. Si la cocina no puede
  prepararlo, el administrador lo anula (Historia 5).
- **La carta cambia de precio con una mesa atendida**: los ítems ya enviados conservan el precio
  con el que se enviaron.
- **La mesa cambia de estado mientras el mozo la tiene abierta** (por ejemplo, Caja la cobra o
  otro mozo pide la cuenta): la acción que intente el mozo sobre el estado anterior se rechaza
  con un mensaje y su pantalla muestra el estado actual.
- **El administrador anula un ítem que la cocina acaba de marcar listo**: vale el estado al
  momento de confirmar; si ya está listo, la anulación se rechaza (AC-5.4).
- **Se pide la cuenta con platos todavía pendientes o en preparación**: se permite. Esos ítems
  cuentan en el consumo; si el cliente ya no los quiere, el administrador los anula antes del
  cobro.

## Requirements *(mandatory)*

### Functional Requirements

**Mesas**

- **FR-001**: El sistema MUST mostrar a cada mozo todas las mesas del local con su número, su
  estado (libre, ocupada o por cobrar) y, en las que no están libres, su mozo responsable.
- **FR-002**: El mozo MUST poder abrir una mesa libre. Al abrirla, la mesa pasa a ocupada y se
  inicia un pedido con el mozo que la abrió y la hora de apertura.
- **FR-003**: El sistema MUST garantizar que una mesa tenga como máximo un pedido en curso. Si
  dos mozos intentan abrir la misma mesa a la vez, solo uno lo logra y el otro recibe un mensaje
  que indica qué mozo la abrió.
- **FR-004**: Al abrir una mesa, el mozo MUST poder indicar el número de comensales (un número
  entero de 1 o más), pero no es obligatorio: sin ese dato la mesa se abre igual. Mientras el
  pedido esté en curso, cualquier mozo que atienda la mesa MUST poder registrarlo o cambiarlo.
- **FR-005**: El sistema MUST permitir que cualquier mozo tome pedidos, los envíe y pida la cuenta
  de cualquier mesa ocupada, aunque la haya abierto otro mozo. El mozo que abrió la mesa sigue
  siendo su responsable.
- **FR-006**: El mozo responsable, y ningún otro mozo, MUST poder cancelar la apertura de una mesa
  mientras no se haya enviado nada a cocina; tras confirmarlo, la mesa vuelve a libre y el pedido
  se descarta, con los ítems por enviar que tuviera.
- **FR-007**: El sistema MUST NOT permitir que un mozo libere una mesa con algo enviado a cocina.
  Esa mesa vuelve a libre solo cuando Caja (módulo 4) registra el cobro de su cuenta.
- **FR-008**: Los cambios de estado de las mesas MUST reflejarse en las pantallas de todos los
  mozos conectados sin que tengan que recargar.

**Toma del pedido**

- **FR-009**: Al tomar un pedido, el sistema MUST ofrecer solo los platos y bebidas que la carta
  (módulo 1) marca como disponibles en ese momento, con su nombre y su precio.
- **FR-010**: El mozo MUST poder agregar un ítem indicando el plato o bebida, la cantidad (un
  número entero de 1 o más) y, si quiere, una nota breve de texto libre para ese ítem.
- **FR-011**: El sistema MUST registrar como ítems separados el mismo plato agregado con notas
  distintas.
- **FR-012**: Mientras un ítem no se haya enviado, el mozo MUST poder cambiar su cantidad o su
  nota, o quitarlo, sin autorización de nadie. Quitarlo MUST pedir confirmación.
- **FR-013**: Los ítems tomados y no enviados MUST conservarse en el pedido de la mesa hasta que
  se envíen o se quiten, aunque el mozo cambie de pantalla, atienda otra mesa o pierda la conexión.
- **FR-014**: El pedido de una mesa MUST distinguir a simple vista los ítems no enviados de los
  ya enviados.

**Envío a cocina**

- **FR-015**: El mozo MUST poder enviar a cocina, con una sola acción, todos los ítems no enviados
  de la mesa.
- **FR-016**: Cada envío MUST incluir únicamente los ítems no enviados en ese momento. Cada ítem
  pertenece a un solo envío y nunca se reenvía.
- **FR-017**: Cada envío MUST registrar la mesa, el mozo que lo envió, la fecha y hora, un número
  de orden correlativo y, por cada ítem, el plato o bebida, la cantidad y la nota.
- **FR-018**: El sistema MUST hacer llegar cada envío a la cocina (módulo 3) sin que nadie recargue
  su pantalla, y la cocina MUST recibir los envíos en el orden en que se confirmaron.
- **FR-019**: Si no hay ítems no enviados, el sistema MUST NOT registrar un envío y MUST informar
  al mozo que no hay nada nuevo que enviar.
- **FR-020**: Al enviar, el sistema MUST comprobar que cada ítem sigue disponible. Si alguno ya no
  lo está, MUST NOT enviar nada, MUST indicar al mozo cuáles son y MUST permitirle quitarlos o
  cambiarlos antes de volver a enviar.
- **FR-021**: El mozo MUST recibir una confirmación explícita cuando un envío queda registrado. Sin
  esa confirmación (por ejemplo, por falta de conexión), los ítems MUST seguir como no enviados y
  el mozo MUST poder reintentar.
- **FR-022**: Reintentar un envío cuyo resultado quedó incierto MUST NOT producir un envío
  duplicado en la cocina.
- **FR-023**: Todo envío confirmado MUST quedar registrado de forma permanente: no se pierde
  aunque se desconecte la tablet del mozo o la pantalla de cocina, y la cocina puede recuperar
  los envíos que recibió mientras estuvo desconectada.
- **FR-024**: Un ítem enviado MUST NOT poder quitarse ni modificarse por el mozo; solo puede
  anularse según FR-028 a FR-031.
- **FR-025**: Cada ítem MUST conservar el precio unitario vigente al momento de enviarse; los
  cambios posteriores de precio en la carta no alteran los ítems ya enviados.

**Seguimiento y avisos**

- **FR-026**: El mozo MUST ver el estado de cada ítem enviado (pendiente, en preparación, listo o
  anulado), y los cambios que haga la cocina MUST reflejarse sin recargar la pantalla.
- **FR-027**: Cuando la cocina marca listo un ítem, el sistema MUST avisar al mozo responsable de
  esa mesa, y solo a él, aunque el ítem lo haya tomado o enviado otro mozo, con un aviso que indique la mesa, el plato y la cantidad. El aviso MUST
  verse en cualquier pantalla del módulo y permanecer hasta que el mozo lo marque como visto.
  Lo implementa la 004 (FR-015 a FR-018).

**Anulación**

- **FR-028**: El sistema MUST permitir anular un ítem ya enviado solo a usuarios con rol de
  administrador, desde su propia sesión. Para ubicarlo, el administrador MUST poder ver las mesas, sus pedidos y los
  ítems enviados.
- **FR-029**: El administrador MUST poder anular el ítem completo o solo parte de su cantidad,
  indicando cuántas unidades anula (por defecto, todas); las unidades no anuladas siguen su curso
  en cocina. Anular MUST exigir un motivo y una confirmación; sin motivo, no se anula nada.
- **FR-030**: El sistema MUST permitir anular solo ítems en estado pendiente o en preparación; un
  ítem listo no se puede anular.
- **FR-031**: Al anular, el sistema MUST registrar cuántas unidades se anularon, quién las anuló,
  cuándo y por qué, y MUST conservar lo anulado en el pedido (no se borra). La anulación MUST
  llegar a la cocina sin que nadie recargue, indicando cuántas unidades quedan por preparar, y
  MUST verse en el pedido de la mesa.
- **FR-032**: Las unidades anuladas MUST NOT sumar al consumo de la mesa.

**Cuenta**

- **FR-033**: El mozo MUST poder pedir la cuenta de una mesa ocupada que tenga al menos un ítem
  enviado no anulado y ninguno por enviar. Al confirmarlo, la mesa pasa a por cobrar y su pedido,
  con el detalle del consumo, queda disponible para Caja (módulo 4). Si hay ítems por enviar, el
  sistema MUST avisar al mozo y pedirle que los envíe o los quite antes.
- **FR-034**: Con una mesa por cobrar, el sistema MUST permitir que un mozo agregue ítems. Al
  agregar el primero, previa confirmación del mozo, la mesa vuelve a ocupada, se deshace el
  pedido de cuenta y deja de estar disponible para cobrar en Caja. Para cobrarla, un mozo debe
  pedir la cuenta otra vez (FR-033).
- **FR-035**: El mozo MUST poder consultar el consumo de una mesa ocupada o por cobrar: los ítems
  enviados con su cantidad no anulada, precio unitario y subtotal, y el total.
- **FR-036**: Cuando Caja registra el cobro, la mesa MUST pasar a libre para todos los mozos sin que
  recarguen, y su pedido queda cerrado.

**Conexión y uso**

- **FR-037**: El sistema MUST indicar claramente al mozo cuando su dispositivo está sin conexión.
- **FR-038**: Al recuperar la conexión, el sistema MUST mostrar al mozo el estado actual de las
  mesas y de los ítems, y los avisos de platos listos que se produjeron mientras estuvo
  desconectado.
- **FR-039**: Las vistas del mozo MUST poder usarse con toques en tablet, que es el dispositivo
  principal, y también en celular.
- **FR-040**: Todos los textos, mensajes y avisos del módulo MUST estar en español, y los montos
  MUST mostrarse en soles (S/).
- **FR-041**: Las funciones del módulo MUST estar disponibles solo para usuarios con sesión
  iniciada y según su rol: mozo o administrador.

### Key Entities *(include if feature involves data)*

- **Mesa**: lugar del local identificado por su número; el local tiene entre 8 y 15. Su estado
  es libre, ocupada o por cobrar. Mientras no está libre tiene un único pedido en curso y un
  mozo responsable (el que la abrió), aunque cualquier mozo puede atenderla. Cambios de estado: libre → ocupada (el mozo la abre); ocupada → por cobrar
  (el mozo pide la cuenta); por cobrar → ocupada (un mozo agrega ítems antes del cobro); por
  cobrar → libre (Caja cobra, módulo 4); ocupada → libre solo al cancelar una apertura sin nada
  enviado.
- **Pedido**: la atención completa de una mesa, desde que se abre hasta que se cobra. Tiene la
  mesa, el mozo que la abrió, la hora de apertura, el número de comensales (opcional), sus
  ítems y sus envíos. Su consumo es la suma de las unidades enviadas no anuladas. Termina cobrado
  (lo cierra Caja) o cancelado (apertura sin nada enviado).
- **Ítem del pedido**: un plato o bebida de la carta dentro de un pedido, con cantidad, nota
  opcional y precio unitario. Estados: no enviado → pendiente (al enviarse) → en preparación →
  listo, o anulado desde pendiente o en preparación. El mozo maneja el ítem mientras no está
  enviado; la cocina (módulo 3) lo pasa a en preparación y a listo; el administrador lo anula.
  La anulación puede ser de todas sus unidades o solo de algunas: si se anulan todas, el ítem
  queda anulado; si se anulan algunas, sigue su curso con las restantes. Cada anulación guarda
  cuántas unidades anuló, el motivo, quién la hizo y cuándo.
- **Envío a cocina**: una ronda de ítems que el mozo manda a cocina de una vez. Tiene la mesa,
  el mozo, la fecha y hora, un número correlativo que fija el orden en que la cocina lo recibe y
  los ítems que incluye. No cambia después de registrarse; las anulaciones posteriores quedan en
  el ítem.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En pruebas con cortes de conexión de la tablet del mozo antes, durante y después
  de enviar, el 100 % de los envíos confirmados aparecen en la cocina, ninguno aparece dos veces
  y ningún ítem tomado se pierde.
- **SC-002**: El 100 % de los envíos aparecen en la cocina en el mismo orden en que se
  confirmaron, también cuando varios mozos envían casi al mismo tiempo.
- **SC-003**: Con conexión normal, en al menos el 95 % de los casos un envío confirmado aparece en
  la pantalla de cocina en 3 segundos o menos, sin que nadie recargue.
- **SC-004**: Con conexión normal, en al menos el 95 % de los casos los cambios de estado de mesas
  e ítems, los avisos de plato listo y las anulaciones se ven en las pantallas afectadas en
  3 segundos o menos.
- **SC-005**: En un turno de prueba con todas las mesas del local, los mozos atienden cada mesa
  de principio a fin (abrir, tomar, enviar varias rondas, seguir estados y pedir la cuenta) sin
  anotar nada en papel.
- **SC-006**: Un mozo abre una mesa, toma un pedido de 4 ítems con al menos una nota y lo envía a
  cocina en menos de 90 segundos.
- **SC-007**: El 100 % de las anulaciones de ítems enviados tienen registrados el motivo, el
  administrador, la hora y las unidades anuladas, y ninguna unidad anulada suma al consumo de su
  mesa.
- **SC-008**: En pruebas en que dos mozos abren la misma mesa a la vez, nunca quedan dos pedidos
  en curso para una misma mesa.

## Assumptions

**Supuestos de negocio (a confirmar en la clarificación)**

- El aviso de plato listo llega solo al mozo responsable, es decir, al que abrió la mesa
  (confirmado en Clarifications), aunque otro mozo haya tomado o enviado el ítem.
- Solo se anula un ítem pendiente o en preparación; uno listo ya no.
- El administrador anula desde su propia sesión. El mozo le pide la anulación de palabra; el
  módulo no incluye un flujo de solicitud de anulación.
- La regla "la mesa la libera Caja al cobrar" se aplica a mesas con algo enviado a cocina. Una
  mesa abierta por error, sin nada enviado, no tiene cuenta que cobrar y el mozo que la abrió
  puede cancelar su apertura (confirmado en Clarifications).
- Si un plato se agota antes de enviarlo, se detiene todo el envío para que el mozo decida con
  el cliente qué quitar o cambiar, en lugar de enviar solo una parte.
- Se puede pedir la cuenta aunque haya platos todavía pendientes o en preparación.
- Todo lo que se pide, bebidas incluidas, se envía a cocina, que es la única área de
  preparación; no hay barra separada.
- "Listo" es el último estado que registra la cocina; este módulo no registra cuándo se sirve el
  plato en la mesa.
- La nota de un ítem es un texto libre corto, de hasta 140 caracteres.

**Entorno y uso**

- Una sola picantería, con entre 8 y 15 mesas y pocos mozos trabajando a la vez (hasta 5).
- La lista de mesas del local, identificadas por número, ya existe cuando se usa el módulo; su
  alta y edición no forman parte de esta especificación.
- El dispositivo principal del mozo es la tablet; el celular también debe servir.
- El módulo no exige trabajar sin conexión: sin conexión no se envía nada a cocina. Lo que sí
  exige es que no se pierda lo tomado ni lo enviado y que el mozo sepa en todo momento qué salió
  y qué no.

**Dependencias con otros módulos**

- Carta (módulo 1): provee los platos y bebidas, sus precios y su disponibilidad. Este módulo
  solo los consulta.
- Cocina (módulo 3): muestra los envíos, cambia los ítems a en preparación y a listo, y muestra
  las anulaciones.
- Caja (módulo 4): recibe las mesas por cobrar con su consumo, cobra y libera la mesa.
- Base común: inicio de sesión, usuarios y roles de mozo y administrador.

**Fuera de alcance**

- De este módulo: gestionar la carta y la disponibilidad de platos (módulo 1), la pantalla de
  cocina y el cambio de estados (módulo 3), el cobro, la división de la cuenta y el cierre del
  día (módulo 4), y el inicio de sesión y los usuarios (base común). Tampoco se incluyen juntar
  o separar mesas ni pasar un pedido de una mesa a otra.
- Del proyecto: delivery, facturación electrónica, inventario y pagos en línea.
