# Quickstart: validar el módulo Cocina

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Guía para comprobar de punta a punta que la feature cumple su spec. Requiere que la 001 y la
003 ya estén en `main` (la cocina muestra envíos de la 003).

## Requisitos

- Node.js 22, Docker y Docker Compose.
- `.env` creado a partir de `.env.example` ([quickstart de la 001](../001-base-comun/quickstart.md)).
- Usuarios de prueba: un administrador, dos mozos (Juan y Rosa) y uno de cocina.

## Levantar

```bash
npm ci
docker compose up --build        # db, api (aplica migraciones y semilla) y web
```

La aplicación queda en `http://localhost:8080`.

## Puertas de calidad

```bash
npm run typecheck
npm run lint
npm test                         # incluye las pruebas de aceptación de la API y las de web
npm run test:e2e                 # Playwright en tablet vertical y horizontal
npm run check:ac -- 004          # cada AC-x.y de la spec tiene al menos una prueba [004]
```

Resultado esperado: todo pasa y `check:ac` muestra `✓ 004-cocina: 28/28 criterios cubiertos`.

## Validación manual (demo)

Abrir `/cocina` en una tablet (o en el navegador con 768×1024) con el usuario de cocina, y
`/mozo` en otra ventana con Juan.

| # | Paso | Resultado esperado | Spec |
|---|------|--------------------|------|
| 1 | Sin pedidos, abrir `/cocina` | "No hay pedidos pendientes" | AC-1.1 |
| 2 | Juan abre la mesa 5 y envía 2 ají de gallina ("sin ají") y 2 chichas | Comanda N.º 1, "Mesa 5", con nota resaltada y bebidas; resaltado y sonido sin recargar | AC-1.3, AC-1.4, AC-1.7 |
| 3 | Rosa envía otra ronda para la mesa 5 | Comanda N.º 2, "Mesa 5 · 2.ª ronda", debajo de la N.º 1 | AC-1.2, AC-1.5 |
| 4 | Tocar "Preparar" y luego "Listo" en el ají de gallina | Cambia el estado; Juan (no Rosa) ve "Mesa 5: 2 × Ají de gallina — listo" | AC-2.1, AC-2.2, AC-3.1, AC-3.5 |
| 5 | Tocar "Deshacer" sobre ese Listo y confirmar | Vuelve a En preparación y el aviso de Juan desaparece | AC-2.5, AC-3.4 |
| 6 | Marcarlo Listo otra vez; Juan toca "Visto"; intentar "Deshacer" | "El mozo ya recogió este plato" | AC-2.8 |
| 7 | El administrador anula 1 chicha | Aviso arriba "Mesa 5: 1 × Chicha morada anulado"; el ítem muestra "1 anulada"; desaparece al tocar "Entendido" | AC-5.2, AC-5.5 |
| 8 | Dejar una comanda 15 y 25 minutos (o adelantar el reloj en pruebas) | "Demorado" (ámbar) y "Muy demorado" (rojo), con texto | AC-4.2 |
| 9 | Desconectar la red de la tablet de cocina, enviar un pedido y reconectar | "Sin conexión" mientras dura; al volver, la comanda aparece una sola vez | FR-025, SC-006 |
| 10 | Girar la tablet | Sin desplazamiento horizontal en ambas orientaciones | Principio IV |

Contratos de referencia: [rest-api.yaml](contracts/rest-api.yaml) y
[websocket-events.md](contracts/websocket-events.md).
