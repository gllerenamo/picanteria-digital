# Quickstart: validar la feature 005-caja-reportes

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Cómo levantar el sistema ver [001 quickstart](../001-base-comun/quickstart.md). Aquí solo se
documenta lo propio de Caja.

## 1. Preparar datos

```bash
docker compose up --build -d
```

```bash
npm run db:seed:e2e -w @picanteria/api
```

**Resultado esperado**: los usuarios de prueba (`caja.e2e`, `mozo.e2e`, `admin.e2e`, …) y las
mesas 1 a 12 libres. Las cuentas se generan con el flujo real de la 003: con `mozo.e2e`, abrir
tres mesas, tomar y enviar platos (en una, anular una unidad con `admin.e2e`) y pedir la cuenta.

## 2. Comprobaciones automáticas

| Comando | Qué verifica |
|---------|--------------|
| `npm test` | Pruebas de aceptación de la API de Caja (`[005] AC-*`) contra `picanteria_test` |
| `npm run test:e2e` | Pantallas de caja y reportes en tablet |
| `npm run check:ac -- 005` | Los 30 criterios de [spec.md](spec.md) tienen prueba |

## 3. Recorrido manual

Con `caja.e2e` en una ventana y `mozo.e2e` en otra (o el administrador):

1. **Lista en vivo**: `/caja` muestra las mesas por cobrar con total y saldo (AC-1.1).
2. **Detalle**: abrir la mesa con anulados; lo anulado aparece tachado y no suma (AC-1.2).
3. **Efectivo**: cobrar el total con un monto recibido mayor; se ve el vuelto y la mesa
   desaparece de la lista y aparece libre para el mozo (AC-1.3).
4. **Dividir por partes iguales**: en la mesa para dividir, 3 partes; pagar una con Yape/Plin y
   otra con tarjeta; la mesa sigue por cobrar; pagar la última en efectivo y se libera
   (AC-2.1, AC-2.3, AC-2.4).
5. **Dividir por ítems** (con otra mesa): asignar unidades; con unidades sin asignar no deja
   confirmar (AC-2.2).
6. **Anular un pago** parcial con motivo; el saldo vuelve a subir (AC-2.7).
7. **Mesa que vuelve a ocupada**: con la cuenta abierta en caja, el
   mozo agrega un plato; el cobro se bloquea; al pedir la cuenta de nuevo, el saldo incluye lo
   agregado (AC-1.7, AC-2.6).
8. **Cierre**: con mesas abiertas, no deja cerrar (AC-3.5). Con todas libres: ingresar lo
   contado con una diferencia en efectivo; se exige la observación; confirmar (AC-3.1 a AC-3.3).
   Un cobro posterior no cambia ese cierre (AC-3.4). Revisar `/caja/cierres` (AC-3.6).
9. **Reportes** (`admin.e2e`): `/admin/reportes` con el rango de hoy; los totales coinciden con
   lo cobrado y el ranking muestra los platos sin contar lo anulado (US4, US5). Con `caja.e2e`,
   `/admin/reportes` muestra el aviso de permiso (AC-4.5).

## Referencias

- Contrato HTTP: [contracts/rest-api.yaml](contracts/rest-api.yaml)
- Eventos: [contracts/websocket-events.md](contracts/websocket-events.md)
- Pantallas: [contracts/ui-routes.md](contracts/ui-routes.md)
- Dependencias con la 003: [contracts/dependencias-003.md](contracts/dependencias-003.md)
- Modelo de datos: [data-model.md](data-model.md)
