# Contrato de pantallas: Caja y reportes

**Feature**: 005-caja-reportes | Matriz base: [001 ui-routes](../../001-base-comun/contracts/ui-routes.md)

## Rutas

| Ruta | Pantalla | ADMIN | WAITER | KITCHEN | CASHIER | Criterios |
|------|----------|:-----:|:------:|:-------:|:-------:|-----------|
| `/caja` | Mesas por cobrar | ✅ | ❌ | ❌ | ✅ inicial | AC-1.1, AC-1.8 |
| `/caja/cuentas/:orderId` | Cuenta: detalle, división y pagos | ✅ | ❌ | ❌ | ✅ | AC-1.2 a AC-1.7, US2 |
| `/caja/cierre` | Cierre del día | ✅ | ❌ | ❌ | ✅ | US3 |
| `/caja/cierres` | Historial de cierres | ✅ | ❌ | ❌ | ✅ | AC-3.6 |
| `/admin/reportes` | Reportes: ventas y platos más vendidos | ✅ | ❌ | ❌ | ❌ | US4, US5, AC-4.5 |

- `/caja` y sus subrutas ya están cubiertas por la entrada `/caja` de `APP_ROUTES`.
- Se agrega `{ path: '/admin/reportes', label: 'Reportes', roles: [] }` a `APP_ROUTES`; el menú
  del administrador queda: Usuarios, Carta, Reportes, Mozo, Cocina, Caja.

## Elementos clave por pantalla

- **Mesas por cobrar**: tarjetas con "Mesa N", mozo, total y saldo; se actualizan en vivo.
- **Cuenta**: tabla de ítems (anulados tachados con la etiqueta "Anulado"), total, pagado y
  saldo; botones "Cobrar", "Dividir cuenta" y, con total cero, "Cerrar sin cobro". El formulario
  de pago tiene "Método" (Efectivo, Yape/Plin, Tarjeta), "Monto", "Monto recibido" y "Vuelto"
  (solo efectivo) y "Referencia" (Yape/Plin y tarjeta). Si la mesa vuelve a ocupada, aviso
  "El mozo agregó pedidos. Espera a que vuelva a pedir la cuenta." y cobro deshabilitado.
- **Dividir cuenta**: pestañas "Partes iguales" (cantidad de personas) y "Por ítems" (asignar
  unidades a cada parte, contador de unidades sin asignar).
- **Cierre**: paso 1 "Montos contados" (efectivo, Yape/Plin, tarjeta); paso 2 tabla
  "Registrado / Contado / Diferencia", observación y "Confirmar cierre". Con mesas abiertas:
  "No puedes cerrar con mesas abiertas" y la lista de mesas.
- **Reportes**: selector "Desde"–"Hasta" (por defecto, el mes actual), pestañas "Ventas" y
  "Platos más vendidos" con orden "Por unidades" / "Por monto".

## Requisitos de interfaz

- Montos `S/ 0.00` y fechas día/mes/año (FR-027).
- Liberar la mesa al cobrar el saldo completo, anular un pago y confirmar el cierre piden
  confirmación (FR-028).
- La pantalla de caja se usa en computadora o tablet: áreas táctiles de 44 px y sin
  desplazamiento horizontal desde 768 px, como las demás vistas operativas.
