# Quickstart: validar la feature 003-mesas-pedidos

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Guía para comprobar de extremo a extremo que la feature funciona. Parte del entorno de la 001
([quickstart.md](../001-base-comun/quickstart.md)): misma configuración `.env`, mismo Docker
Compose y mismas bases `picanteria` y `picanteria_test`.

## Requisitos previos

- Lo de la 001: Node.js 22, npm 10, Docker Desktop con Compose v2 y los navegadores de
  Playwright.
- La migración de la 003 aplicada (`<fecha>_orders`, [data-model.md §6](data-model.md)).
- La semilla de la 002 cargada: carta y mesas de ejemplo.
- Usuarios de prueba: dos mozos, un administrador y, para el recorrido completo, un usuario de
  cocina. Se crean desde `/admin/usuarios`.

## 1. Levantar el sistema

```bash
docker compose up --build
```

**Resultado esperado**: la API aplica las migraciones, incluida la de la 003, y la aplicación
responde en `http://localhost:8080`. Para desarrollo, los pasos alternativos de la 001
(`docker compose up db -d`, `npm run db:migrate`, `npm run dev`).

## 2. Comprobaciones automáticas

| Comando | Qué verifica | Principio |
|---------|--------------|-----------|
| `npm run typecheck` | Compilación sin errores, incluidos los esquemas y eventos nuevos de `packages/shared` | I |
| `npm run lint` | Sin `any` ni `@ts-ignore` | I |
| `npm run test --workspace apps/api` | Aceptación de la API de pedidos, concurrencia y eventos contra `picanteria_test` | II |
| `npm run test --workspace apps/web` | Componentes de `/mozo` con MSW | II, III |
| `npm run test:e2e` | Recorrido del mozo en 768×1024 y 1366×1024 | II, IV |
| `npm run check:ac -- 003` | Cada `AC-x.y` de [spec.md](spec.md) aparece en una prueba `[003] AC-x.y` | II |

**Resultado esperado**: todos terminan con código 0 y `check:ac -- 003` da 41/41. Los avisos
de plato listo son criterios de la 004 ([research.md §16](research.md)).

## 3. Recorrido manual

Usar dos tablets o dos ventanas en modo dispositivo (768×1024): **A** con el mozo 1, **B** con
el mozo 2. Una tercera con el administrador y, si la 004 está integrada, una con cocina.

| # | Pasos | Resultado esperado | Criterios |
|---|-------|--------------------|-----------|
| 1 | A y B entran a `/mozo`. | Ven las mismas mesas, todas "Libre". | AC-1.1 |
| 2 | A abre la mesa 3 sin indicar comensales. | Pasa al pedido; en B la mesa 3 aparece "Ocupada · Mozo 1" sin recargar. | AC-1.2, AC-1.3, AC-1.7 |
| 3 | A y B tocan a la vez la mesa 5 y confirman. | Solo uno la abre; el otro ve "La mesa ya la abrió …". | AC-1.5 |
| 4 | En la mesa 3, A agrega 2 × Rocoto relleno con nota "sin ají", luego otro con otra nota; cambia una cantidad y quita un ítem. | Ítems separados por nota; cambios sin pedir permiso; quitar pide confirmación. | AC-2.3 a AC-2.6 |
| 5 | A toca "Enviar a cocina". | "Ronda 1 enviada a cocina"; ítems "Pendiente"; cocina recibe la comanda en menos de 3 s. | AC-3.1, AC-3.2, SC-003 |
| 6 | A agrega 1 × Chicha y envía de nuevo; toca "Enviar" sin nada nuevo. | La ronda 2 lleva solo la chicha; el botón queda deshabilitado. | AC-3.3, AC-3.4 |
| 7 | B agrega un plato en la mesa 3 (de A) y lo envía. | Se envía; la ronda registra a B; la mesa sigue con A como responsable. | AC-3.10 |
| 8 | El administrador marca un plato "No disponible" en `/admin/carta` mientras A lo tiene por enviar; A envía. | No se envía nada y el ítem queda marcado; al quitarlo, el envío sale. | AC-3.5 |
| 9 | Con las herramientas del navegador, A queda sin conexión y toca "Enviar". | Banner "Sin conexión"; el envío no sale y los ítems siguen por enviar. Al volver la conexión, "Reintentar" envía una sola vez. | AC-3.8, AC-3.9, SC-001 |
| 10 | El administrador abre la mesa 3 en `/mozo` y anula 1 de 2 unidades de un ítem pendiente, primero sin motivo y luego con motivo. | Sin motivo no deja; con motivo, cocina ve "1 anulada" y el consumo baja. | AC-5.1 a AC-5.3, AC-5.7 |
| 11 | Cocina marca un ítem "Listo" (o, sin la 004, se cambia su estado en la base); el administrador intenta anularlo. | "El plato ya está listo; no se puede anular". | AC-5.4 |
| 12 | A toca "Pedir la cuenta" con un ítem por enviar; luego lo envía y pide la cuenta. | Primero el aviso de ítems sin enviar; luego la mesa pasa a "Por cobrar" en B sin recargar. | AC-6.3, AC-6.1 |
| 13 | Con la mesa por cobrar, A agrega una bebida y confirma "Volver a abrirla". | La mesa vuelve a "Ocupada"; para cobrar hay que pedir la cuenta otra vez. | AC-6.7 |
| 14 | A abre la mesa 7 por error; B intenta cancelar la apertura; luego A la cancela. | B no puede; A sí, y la mesa vuelve a "Libre". | AC-1.8, AC-1.6 |
| 15 | Cronometrar: abrir una mesa, tomar 4 ítems con una nota y enviarlos. | Menos de 90 s. | SC-006 |

Con la 004 integrada, se agregan los avisos: el mozo responsable recibe el aviso de plato listo
en cualquier pantalla, otro mozo no lo recibe, y tras un corte de conexión aparecen los avisos
pendientes (004 AC-3.1, AC-3.3 y AC-3.5).

## Referencias

- Decisiones técnicas: [research.md](research.md)
- Entidades y estados: [data-model.md](data-model.md)
- API: [contracts/rest-api.yaml](contracts/rest-api.yaml)
- Tiempo real: [contracts/websocket-events.md](contracts/websocket-events.md)
- Pantallas: [contracts/ui-routes.md](contracts/ui-routes.md)
