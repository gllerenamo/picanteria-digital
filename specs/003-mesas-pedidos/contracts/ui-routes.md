# Contrato de pantallas: Mesas y pedidos

**Feature**: 003-mesas-pedidos | **Matriz de acceso**: la de la 001
([ui-routes.md](../../001-base-comun/contracts/ui-routes.md)).

`/mozo` ya existe en `APP_ROUTES` (`roles: ['WAITER']`, más `ADMIN`) y es la pantalla inicial
del mozo. `appRouteFor` trata `/mozo/...` como `/mozo`, así que **`APP_ROUTES` no cambia**: la
subruta hereda el mismo permiso. Las dos pantallas se registran en
`apps/web/src/app/router.tsx` dentro de `RequireRole`.

## Pantallas

| Ruta | Pantalla | ADMIN | WAITER | Reemplaza | Criterios |
|------|----------|:-----:|:------:|-----------|-----------|
| `/mozo` | Mesas (`TablesBoardPage`) | ✅ | ✅ inicial | `WaiterHome` provisional de la 001 | AC-1.1 a AC-1.5, AC-6.1, AC-6.5, AC-6.6 |
| `/mozo/pedidos/:orderId` | Pedido de una mesa (`OrderPage`) | ✅ | ✅ | — | AC-1.6 a AC-1.8, Historias 2 a 6 |

### `/mozo`: Mesas

- Una tarjeta por mesa con su número y su estado con texto y color: "Libre", "Ocupada", "Por
  cobrar". En las no libres, el mozo responsable y los comensales si se registraron.
- Tocar una mesa libre la abre, previa confirmación ("¿Abrir la mesa 5?"), con un campo opcional
  de comensales, y lleva al pedido. Tocar una mesa ocupada o por cobrar lleva a su pedido.
- Si otro mozo la abrió primero, el mensaje de la API ("La mesa ya la abrió {nombre}") aparece
  y la tarjeta se actualiza (AC-1.5).
- Se actualiza sola con `orders:table-status-changed` (AC-1.3, AC-6.1, AC-6.6).

### `/mozo/pedidos/:orderId`: Pedido

Encabezado: "Mesa N", estado de la mesa, responsable, comensales (editables, AC-1.7) y
acciones de mesa.

| Zona | Contenido | Acciones |
|------|-----------|----------|
| **Carta** | Platos y bebidas disponibles por categoría, con precio en soles, leídos de `GET /api/menu/tree?availableOnly=true` (002). | Agregar con cantidad (pasos de +/−) y nota opcional (AC-2.1 a AC-2.4). |
| **Por enviar** | Ítems `DRAFT` con cantidad, nota y precio actual; los que ya no están disponibles se marcan "No disponible". | Cambiar cantidad o nota (AC-2.5); quitar con confirmación (AC-2.6); "Enviar a cocina" (AC-3.1). |
| **Enviado** | Ítems enviados agrupados por ronda ("Ronda 1 · 12:40"), cada uno con su estado: "Pendiente", "En preparación", "Listo" o "Anulado", y las unidades anuladas con su motivo. | Solo `ADMIN`: "Anular" en ítems pendientes o en preparación (AC-5.1). |
| **Consumo** | Ítems enviados no anulados con cantidad, precio unitario y subtotal, y el total en soles (AC-6.2). | "Pedir la cuenta" (AC-6.1). |

Acciones de mesa:

| Acción | Visible si | Confirmación |
|--------|-----------|--------------|
| "Cancelar apertura" | `canCancel` (responsable o administrador, sin nada enviado) | "¿Cancelar la apertura de la mesa N? Se descartará lo anotado." |
| "Pedir la cuenta" | `canRequestBill` | "¿Pedir la cuenta de la mesa N?" |
| Ninguna para liberar la mesa | — | Solo Caja la libera (AC-6.5) |

## Diálogos y mensajes

| Situación | Texto | Criterio |
|-----------|-------|----------|
| Enviar sin ítems nuevos | El botón queda deshabilitado; si la API responde `NOTHING_TO_SEND` (por ejemplo, otro mozo ya envió), "No hay nada nuevo que enviar". La prueba de AC-3.4 verifica las dos cosas. | AC-3.4 |
| Plato agotado al enviar | "Algunos platos ya no están disponibles. Quítalos o cámbialos para enviar." y los ítems quedan marcados | AC-3.5 |
| Envío confirmado | "Ronda N enviada a cocina" | AC-3.1 |
| Sin conexión al enviar | "No se pudo enviar: no hay conexión. Tus ítems siguen por enviar." y el botón "Reintentar", que usa la misma clave | AC-3.8, AC-3.9 |
| Agregar a una mesa por cobrar | "La mesa está por cobrar. ¿Volver a abrirla para agregar?" | AC-6.7 |
| Pedir la cuenta con ítems por enviar | "Hay ítems sin enviar. Envíalos o quítalos antes de pedir la cuenta." | AC-6.3 |
| Anular (administrador) | Diálogo con unidades (por defecto, todas las que quedan), motivo obligatorio y "Anular"; sin motivo no se habilita | AC-5.1, AC-5.3, AC-5.7 |
| Sin conexión | `ConnectionBanner`: "Sin conexión. Lo enviado está a salvo; para enviar a cocina necesitas conexión." | FR-037 |

Los avisos de plato listo no son de esta feature: la bandeja `ReadyNoticesTray` de la 004 se
muestra en el encabezado para el rol mozo en todas las pantallas (FR-027; 004 AC-3.1, AC-3.3 y
AC-3.5).

## Requisitos de tablet (Principio IV)

Se verifican con Playwright en 768×1024 y 1366×1024, igual que la 001:

- Sin desplazamiento horizontal en las dos pantallas; en vertical la carta y el pedido se
  apilan, en horizontal van lado a lado.
- Botones, pasos de cantidad y tarjetas de mesa de al menos 44×44 px (utilidad `touch-target`).
- Nada depende de `hover`, clic derecho ni atajos de teclado.
- Toda acción destructiva pide confirmación: quitar un ítem, cancelar la apertura, anular, y
  también pedir la cuenta y reabrir una mesa por cobrar.
- Estados con texto además del color (contraste WCAG AA).
