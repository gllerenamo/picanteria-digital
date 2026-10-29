# Picantería Digital

Sistema web para una picantería: reemplaza la libreta del mozo, ordena las comandas de la cocina
y facilita el cobro en caja. La interfaz está en español y optimizada para tablet en las vistas
de mozo y cocina.

## Stack

- **Frontend**: React 19 + Vite (`apps/web`)
- **Backend**: NestJS 11 con un módulo por dominio (`apps/api`)
- **Base de datos**: PostgreSQL 17 con Prisma
- **Tiempo real**: Socket.IO
- **Contratos compartidos**: roles, esquemas Zod y eventos (`packages/shared`)
- **Infraestructura**: Docker Compose

Todo el código está en TypeScript estricto. Las reglas del proyecto están en la
[constitución](.specify/memory/constitution.md).

## Requisitos

- Node.js 22 LTS y npm 10 o superior
- Docker Desktop con Docker Compose v2

## Inicio rápido

```bash
cp .env.example .env
```

Edita `.env` con tus claves y luego levanta todo el sistema:

```bash
docker compose up --build
```

La aplicación queda en http://localhost:8080. Ingresa con el administrador inicial definido en
`INITIAL_ADMIN_USERNAME` e `INITIAL_ADMIN_PASSWORD`.

Para desarrollar con recarga automática, levanta solo la base de datos y ejecuta las apps:

```bash
docker compose up db -d
```

```bash
npm install
```

```bash
npm run db:migrate
```

```bash
npm run dev
```

La guía completa de validación está en
[specs/001-base-comun/quickstart.md](specs/001-base-comun/quickstart.md).

## Comprobaciones de calidad

| Comando | Qué verifica |
|---------|--------------|
| `npm run typecheck` | TypeScript estricto sin errores |
| `npm run lint` | Sin `any` ni `@ts-ignore` |
| `npm test` | Pruebas unitarias, de componentes y de aceptación |
| `npm run test:e2e` | Playwright en tablet (requiere `docker compose up --build`) |
| `npm run check:ac -- 001` | Cada criterio `AC-x.y` de la feature tiene su prueba |

Las pruebas de aceptación de cada feature llevan en su título el prefijo de la feature y el ID
del criterio, por ejemplo `"[001] AC-1.3: …"`.

## Flujo de trabajo del equipo

- Una rama y un PR por feature; la rama se crea antes de empezar con `git switch -c 00X-nombre`.
- Las especificaciones viven en `specs/`: 001 base común, 002 carta, 003 mesas y pedidos,
  004 cocina y 005 caja.
- Cada feature sigue el flujo de Spec Kit: especificación, plan, tareas e implementación.
