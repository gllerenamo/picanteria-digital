---

description: "Lista de tareas de la feature 001-base-comun"
---

# Tasks: Base común — inicio de sesión, roles y gestión de usuarios

**Input**: Design documents from `/specs/001-base-comun/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: OBLIGATORIAS. El Principio II de la constitución exige al menos una prueba
automatizada por criterio de aceptación. Cada prueba de aceptación lleva en su título el prefijo
de la feature y el ID del criterio: `"[001] AC-1.3: …"` ([research.md §13](research.md)). Las
pruebas de cada historia se escriben primero y deben fallar antes de implementar.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Rama**: todo el trabajo va en la rama `001-base-comun` y se integra con un único PR al
terminar la feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monorepo con npm workspaces ([plan.md § Project Structure](plan.md#project-structure)):
`apps/api/` (NestJS), `apps/web/` (React + Vite), `packages/shared/` (contratos compartidos).
Los textos visibles para el usuario van en español (Principio III); los identificadores de
código, en inglés.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicializar el monorepo, las herramientas y la infraestructura de contenedores.

- [X] T001 Crear `package.json` raíz (`"private": true`, `"workspaces": ["apps/*", "packages/*"]`, `"engines": { "node": ">=22" }`) con los scripts `dev` (api y web en paralelo con `concurrently`), `build`, `typecheck`, `lint`, `test`, `test:e2e`, `check:ac` (`tsx scripts/check-ac-coverage.ts`) y `db:migrate`, las devDependencies raíz `typescript`, `tsx`, `concurrently`, y un `.gitignore` con `node_modules/`, `dist/`, `.env`, `coverage/`, `playwright-report/` y `test-results/`
- [X] T002 Crear `tsconfig.base.json` con `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"noFallthroughCasesInSwitch": true`, `"forceConsistentCasingInFileNames": true` y `"skipLibCheck": true`; sin `exactOptionalPropertyTypes` ([research.md §2](research.md))
- [X] T003 [P] Crear `eslint.config.mjs` con `typescript-eslint` en `strictTypeChecked`, `@typescript-eslint/no-explicit-any: "error"`, `@typescript-eslint/ban-ts-comment` en error permitiendo solo `"ts-expect-error": "allow-with-description"`, y `eslint-plugin-react-hooks` para `apps/web`; añadir las devDependencies en el `package.json` raíz
- [X] T004 [P] Crear el paquete `packages/shared` (`package.json` con nombre `@picanteria/shared`, dependencia `zod`, scripts `build` y `typecheck`, script `test` con `vitest run`; `tsconfig.json` que extiende `../../tsconfig.base.json`, compila a CommonJS en `dist/` con declaraciones; `src/index.ts` vacío)
- [X] T005 [P] Crear `apps/api` con NestJS 11 (`package.json`, `nest-cli.json`, `tsconfig.json` que extiende la base y añade `experimentalDecorators` y `emitDecoratorMetadata`, `src/main.ts`, `src/app.module.ts`); dependencias `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `@prisma/client`, `argon2`, `cookie-parser`, `cookie`, `zod`, `@picanteria/shared`; devDependencies `prisma`, `jest`, `ts-jest`, `supertest`, `socket.io-client` y sus tipos
- [X] T006 [P] Crear `apps/web` con Vite + React 19 (`package.json`, `tsconfig.json` que extiende la base, `index.html` con `<html lang="es">` y `<meta name="viewport" content="width=device-width, initial-scale=1">`, `src/main.tsx`); dependencias `react-router`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `zod`, `socket.io-client`, `tailwindcss`, `@picanteria/shared`; en `apps/web/vite.config.ts`, proxy de `/api` y `/socket.io` (con `ws: true`) hacia `http://localhost:3000`, y un alias de `@picanteria/shared` a `packages/shared/src/index.ts` (también en `paths` de `apps/web/tsconfig.json`), para consumir el paquete compartido desde su código fuente sin interoperabilidad CommonJS
- [X] T007 [P] Crear `docker-compose.yml` con los servicios `db` (`postgres:17`, puerto 5432 publicado, volumen persistente, monta `docker/postgres-init.sql`), `api` (puerto 3000) y `web` (puerto 8080 → 80); `docker/postgres-init.sql` que crea las bases `picanteria` y `picanteria_test`; y `.env.example` con `DATABASE_URL`, `DATABASE_URL_TEST`, `PORT=3000`, `COOKIE_SECURE=false`, `INITIAL_ADMIN_USERNAME` e `INITIAL_ADMIN_PASSWORD` (sin valores reales)
- [X] T008 [P] Crear `apps/api/Dockerfile` (build multi-etapa; al arrancar ejecuta `prisma migrate deploy`, la semilla y luego la API), `apps/web/Dockerfile` (build de Vite servido por nginx) y `docker/nginx.conf` (sirve la SPA con fallback a `index.html`, proxy de `/api` a `api:3000` y de `/socket.io` con las cabeceras `Upgrade` y `Connection` para WebSocket)
- [X] T009 [P] Configurar Jest en `apps/api/jest.config.js` (JavaScript para no requerir `ts-node`) con dos proyectos: `unit` (`src/**/*.spec.ts`) y `acceptance` (`test/**/*.acceptance.spec.ts`, en serie con `--runInBand`, `globalSetup` en `apps/api/test/global-setup.ts` que ejecuta `prisma migrate deploy` contra `DATABASE_URL_TEST`, que debe apuntar a una base terminada en `_test`; cada prueba vacía las tablas); script `test` en `apps/api/package.json`
- [X] T010 [P] Configurar Vitest en `apps/web/vitest.config.ts` (entorno `jsdom`, `setupFiles: ["./tests/setup.ts"]`) y crear `apps/web/tests/setup.ts` (matchers de `@testing-library/jest-dom`, servidor MSW iniciado y reiniciado entre pruebas) y `apps/web/tests/msw/server.ts`; devDependencies `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `msw`
- [X] T011 [P] Configurar Playwright en `apps/web/playwright.config.ts` con `baseURL: "http://localhost:8080"`, los proyectos `tablet-vertical` (viewport 768×1024, `hasTouch: true`) y `tablet-horizontal` (1366×1024, `hasTouch: true`) y `globalSetup: "./e2e/global-setup.ts"`; script `test:e2e` en `apps/web/package.json`; devDependency `@playwright/test`
- [X] T012 [P] Crear `scripts/check-ac-coverage.ts`: por cada `specs/NNN-*/spec.md`, extraer los ID con la expresión `AC-\d+\.\d+`; buscar `[NNN] AC-x.y` en los archivos de prueba (`apps/*/test/**`, `apps/*/tests/**`, `apps/*/e2e/**`, `apps/*/src/**/*.spec.ts`, `packages/*/src/**/*.test.ts`); aceptar números de feature como argumentos (`npm run check:ac -- 001`) y, sin argumentos, revisar solo las features con al menos una prueba etiquetada; imprimir en español los criterios cubiertos y los faltantes y terminar con código 1 si falta alguno ([research.md §13](research.md))

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Contratos compartidos, base de datos, infraestructura de sesión y autorización, y
esqueleto del frontend que necesitan las tres historias.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Contratos compartidos (`packages/shared`)

- [X] T013 [P] Crear `packages/shared/src/roles.ts` según [contracts/ui-routes.md](contracts/ui-routes.md) y [data-model.md § Role](data-model.md): `Role` con los valores `ADMIN | WAITER | KITCHEN | CASHIER`; `ROLE_LABELS` ("Administrador", "Mozo", "Cocina", "Cajero"); `ROLE_HOME` (`/admin/usuarios`, `/mozo`, `/cocina`, `/caja`); `APP_ROUTES` con ruta, etiqueta de menú ("Usuarios", "Mozo", "Cocina", "Caja") y roles permitidos; y `canAccess(role, path)`, donde `ADMIN` accede a todo (FR-011) y cada otro rol solo a su ruta
- [X] T014 [P] Crear `packages/shared/src/errors.ts` con el tipo `ErrorCode` (los 11 códigos del esquema `Error` más `INTERNAL_ERROR` para errores inesperados de [contracts/rest-api.yaml](contracts/rest-api.yaml)), `ERROR_MESSAGES` con los mensajes en español exactos de ese contrato (por ejemplo, `INVALID_CREDENTIALS` → "Usuario o contraseña incorrectos", `LAST_ADMIN` → "Debe existir al menos un administrador activo") y el esquema Zod `apiErrorSchema` (`code`, `message`, `details` opcional)
- [X] T015 [P] Crear `packages/shared/src/events.ts` con `REALTIME_EVENTS` (`auth:session-revoked`, `auth:profile-changed`) y los tipos `SessionRevokedPayload` (`reason: "USER_DISABLED" | "LOGGED_OUT"`) y `ProfileChangedPayload` (`fields: Array<"fullName" | "role">`), según [contracts/websocket-events.md](contracts/websocket-events.md)
- [X] T016 [P] Crear `packages/shared/src/schemas/auth.ts` con `loginRequestSchema` (`username`: se quitan espacios en los extremos, 1 a 30 caracteres; `password`: 1 a 128 caracteres; objeto estricto) y `currentUserSchema` (`id` uuid, `fullName`, `username`, `role`, `homePath`), con los tipos derivados por `z.infer` y mensajes de validación en español
- [X] T017 Exportar `roles`, `errors`, `events` y `schemas/auth` desde `packages/shared/src/index.ts` y verificar que `npm run build -w packages/shared` genera `dist/` (depende de T013–T016)
- [X] T018 [P] Escribir pruebas de `canAccess` en `packages/shared/src/roles.test.ts`: la matriz completa de 4 roles × 4 rutas de [contracts/ui-routes.md](contracts/ui-routes.md), con `ADMIN` permitido en todas y cada otro rol solo en la suya

### Base de datos y configuración del backend

- [X] T019 Definir en `apps/api/prisma/schema.prisma` el enum `Role` y los modelos `User` y `Session` según [data-model.md § Entidades de esta feature](data-model.md): `User.id` UUID; `fullName`; `username` `@unique` ("se guarda en minúsculas"); `passwordHash`; `role`; `isActive` (`@default(true)`); `failedLoginAttempts` (`@default(0)`, "entero ≥ 0"); `lockedUntil` opcional; `createdAt` y `updatedAt` automáticos. `Session.id` UUID; `userId` (relación con `User`, `@@index([userId])`); `tokenHash` `@unique` ("SHA-256 del token enviado en la cookie. El token en claro nunca se guarda"); `createdAt`; `expiresAt`; `revokedAt` opcional; `userAgent` opcional. Generar la migración inicial `init_auth` en `apps/api/prisma/migrations/` (con `prisma migrate diff --from-empty` cuando `migrate dev` no puede ejecutarse de forma interactiva)
- [X] T020 [P] Crear `apps/api/src/config/env.ts` (esquema Zod que valida al arrancar `DATABASE_URL`, `PORT` con valor por defecto 3000, `COOKIE_SECURE` booleano, `INITIAL_ADMIN_USERNAME` e `INITIAL_ADMIN_PASSWORD` opcionales; si falla, termina con un mensaje claro) y `apps/api/src/config/config.module.ts` que lo expone como proveedor global
- [X] T021 [P] Crear `apps/api/src/prisma/prisma.module.ts` (global) y `apps/api/src/prisma/prisma.service.ts` (conecta al iniciar el módulo y se desconecta al cerrar la aplicación)
- [X] T022 [P] Crear `apps/api/src/common/app.exception.ts` (`AppException(code: ErrorCode, status, details?)`, que toma el mensaje de `ERROR_MESSAGES`) y `apps/api/src/common/http-exception.filter.ts` (filtro global que responde siempre `{ code, message, details? }`; convierte 404 de rutas inexistentes a `NOT_FOUND` y errores inesperados a 500 sin filtrar detalles internos)
- [X] T023 [P] Crear `apps/api/src/common/zod-validation.pipe.ts`: valida contra un esquema Zod y, si falla, lanza `VALIDATION_ERROR` (400) con `details` como objeto campo → mensaje en español ([contracts/rest-api.yaml § ValidationError](contracts/rest-api.yaml))
- [X] T024 [P] Crear `apps/api/src/common/csrf.guard.ts`: en POST, PATCH, PUT y DELETE exige la cabecera `X-Requested-With: picanteria-web` y, si falta, responde 403 `CSRF_HEADER_MISSING` ([research.md §5](research.md))

### Sesiones y autorización (módulo `auth`)

- [X] T025 [P] Crear `apps/api/src/auth/password.service.ts` (Argon2id con `argon2`: `hash`, `verify` y `verifyAgainstDummy` para usuarios inexistentes, de modo que el tiempo de respuesta no revele si el usuario existe) y sus pruebas en `apps/api/src/auth/password.service.spec.ts`
- [X] T026 Crear `apps/api/src/auth/sessions.service.ts`: `create(userId, userAgent)` genera 32 bytes aleatorios en base64url, guarda solo su SHA-256 en hexadecimal y fija `expiresAt` = `createdAt + 12 h` (FR-007); `validate(token)` devuelve el usuario solo si `revokedAt` es nulo, `expiresAt > ahora` y el usuario está activo, leyendo el rol del usuario en cada llamada (FR-012); `revoke(sessionId)`; `revokeAllForUser(userId)` devuelve los ID revocados. Pruebas en `apps/api/src/auth/sessions.service.spec.ts`. Crear `apps/api/src/auth/sessions.module.ts`, que provee y exporta `SessionsService` y `PasswordService` (depende de T019, T021, T025)
- [X] T027 [P] Crear los decoradores `apps/api/src/auth/decorators/public.decorator.ts` (`@Public()`), `apps/api/src/auth/decorators/roles.decorator.ts` (`@Roles(...roles)`) y `apps/api/src/auth/decorators/current-user.decorator.ts` (`@CurrentUser()`, que devuelve el usuario y el `sessionId` guardados en la petición)
- [X] T028 Crear `apps/api/src/auth/guards/session.guard.ts` (si la ruta no es `@Public()`, lee la cookie `sid`, la valida con `SessionsService` y adjunta usuario y `sessionId` a la petición; si no es válida, 401 `UNAUTHENTICATED`) y `apps/api/src/auth/guards/roles.guard.ts` (compara `user.role` con `@Roles`; `ADMIN` siempre pasa; si no coincide, 403 `FORBIDDEN`), con pruebas de la matriz de roles en `apps/api/src/auth/guards/roles.guard.spec.ts` (depende de T026, T027)
- [X] T029 Crear `apps/api/src/auth/auth.module.ts` (importa `SessionsModule` y registra con `APP_GUARD`, en este orden, `CsrfGuard`, `SessionGuard` y `RolesGuard`), `apps/api/src/app.setup.ts` con `configureApp(app)` (`cookie-parser`, prefijo global `/api`, filtro global de T022), y actualizar `apps/api/src/app.module.ts` (ConfigModule, PrismaModule, AuthModule) y `apps/api/src/main.ts` para usar `configureApp` (depende de T020–T024, T028)
- [X] T030 Crear `apps/api/prisma/seed.ts` (si no existe ningún usuario `ADMIN`, crea uno con `INITIAL_ADMIN_USERNAME` en minúsculas e `INITIAL_ADMIN_PASSWORD` con hash Argon2id; si ya existe, no hace nada) y configurarlo como `prisma.seed` en `apps/api/package.json`; crear `apps/api/prisma/seed-e2e.ts`, que recrea los usuarios de prueba `admin.e2e`, `mozo.e2e`, `cocina.e2e` y `caja.e2e` (un rol cada uno) con contraseñas de prueba definidas en ese archivo, con el script `db:seed:e2e` ([research.md §15](research.md))
- [X] T031 Crear los auxiliares de prueba de la API: `apps/api/test/helpers/app.ts` (arranca la aplicación Nest con `configureApp` contra `DATABASE_URL_TEST` y permite registrar controladores extra), `apps/api/test/helpers/db.ts` (vacía `Session` y `User` antes de cada prueba) y `apps/api/test/helpers/factories.ts` (`createUser({ role, isActive, password, lockedUntil, failedLoginAttempts })` y `loginAs(agent, user)`, que envía la cabecera CSRF y guarda la cookie) (depende de T029)

### Esqueleto del frontend

- [X] T032 [P] Crear `apps/web/src/lib/api-client.ts`: `fetch` con `credentials: "same-origin"`, cabecera `X-Requested-With: picanteria-web` en POST, PATCH, PUT y DELETE, respuestas de error validadas con `apiErrorSchema` y convertidas en `ApiError` (`code`, `message`, `details`, `status`), y error de red convertido en `ApiError` con el mensaje "No hay conexión. Inténtalo de nuevo."
- [X] T033 [P] Crear `apps/web/src/styles/index.css` con Tailwind y los tokens de tablet del Principio IV: utilidad de área táctil mínima de 44×44 px, tamaño de texto de cocina de 18 px como mínimo, colores con contraste WCAG AA; sin estilos que dependan de `:hover` para mostrar acciones
- [X] T034 Crear `apps/web/src/app/providers.tsx` (`QueryClientProvider`), `apps/web/src/app/router.tsx` (enrutador vacío con la ruta comodín) y conectar ambos en `apps/web/src/main.tsx` junto con `styles/index.css` (depende de T032, T033)
- [X] T035 Crear `apps/web/e2e/global-setup.ts` (ejecuta `npm run db:seed:e2e -w apps/api` contra la base de Docker Compose) y `apps/web/e2e/helpers/auth.ts` (`loginAs(page, "admin" | "mozo" | "cocina" | "caja")` usando la pantalla `/ingresar` y las credenciales de `apps/api/prisma/seed-e2e.ts`) (depende de T030)

**Checkpoint**: la base está lista; las tres historias pueden empezar.

---

## Phase 3: User Story 1 - Iniciar sesión y llegar a la pantalla de mi función (Priority: P1) 🎯 MVP

**Goal**: cualquier trabajador inicia sesión con usuario y contraseña, llega a la pantalla
inicial de su rol y cierra sesión; las credenciales incorrectas, las cuentas desactivadas y
los bloqueos se rechazan con mensajes en español.

**Independent Test**: con los cuatro usuarios de `seed-e2e`, iniciar sesión con cada uno y
comprobar que llega a su pantalla inicial; comprobar el rechazo de credenciales incorrectas, el
bloqueo tras 5 fallos y que cerrar sesión devuelve a `/ingresar`.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T036 [P] [US1] Escribir `apps/api/test/acceptance/auth.acceptance.spec.ts` con: `[001] AC-1.1` (mozo activo → 200, cookie `sid` `HttpOnly`, `SameSite=Strict`, `Max-Age=43200`, `homePath: "/mozo"`); `[001] AC-1.2` (cada uno de los 4 roles recibe su `homePath`); `[001] AC-1.3` (contraseña incorrecta y usuario inexistente → 401 `INVALID_CREDENTIALS` con el mismo mensaje); `[001] AC-1.4` (usuario inactivo con contraseña correcta → 401 `ACCOUNT_DISABLED`; con contraseña incorrecta → `INVALID_CREDENTIALS`); `[001] AC-1.5` (logout → 204, cookie borrada y `GET /api/auth/me` con la cookie anterior → 401); `[001] AC-1.6` (5 fallos → el sexto intento con la contraseña correcta → 423 `ACCOUNT_LOCKED` con `details.lockedUntil`; vencido `lockedUntil` → ingreso correcto y contador reiniciado); `[001] AC-1.7` (`GET /api/auth/me` sin cookie → 401 `UNAUTHENTICATED`). Añadir casos sin ID para FR-007 (sesión con `expiresAt` vencido → 401), para el nombre de usuario con espacios y mayúsculas (`"  Mozo1 "` ingresa como `mozo1`) y para la cabecera CSRF ausente → 403 `CSRF_HEADER_MISSING`
- [X] T037 [P] [US1] Escribir `apps/web/src/features/auth/LoginPage.test.tsx` (MSW): muestra "Usuario o contraseña incorrectos" ante 401; muestra el mensaje de bloqueo ante 423; se envía con la tecla Intro; ante error de red muestra "No hay conexión. Inténtalo de nuevo." y conserva lo escrito; el campo de usuario tiene `autocapitalize="none"` y el de contraseña `type="password"`
- [X] T038 [P] [US1] Escribir `apps/web/e2e/login.spec.ts`: `[001] AC-1.7` (abrir `/mozo` sin sesión redirige a `/ingresar`); `[001] AC-1.1` (ingresar como `mozo.e2e` lleva a `/mozo`); `[001] AC-1.5` ("Cerrar sesión" lleva a `/ingresar` y el botón Atrás del navegador no muestra la pantalla interna)

### Implementation for User Story 1

- [X] T039 [US1] Implementar `apps/api/src/auth/auth.service.ts`: `login(username, password, userAgent)` con el orden de comprobación de [research.md §7](research.md) (inexistente → `INVALID_CREDENTIALS` tras `verifyAgainstDummy`; `lockedUntil > ahora` → `ACCOUNT_LOCKED` sin verificar la contraseña ni alargar el bloqueo; contraseña incorrecta → `INVALID_CREDENTIALS` y `failedLoginAttempts + 1`, fijando `lockedUntil` = "ahora + 15 min al llegar a 5 fallos"; contraseña correcta e inactivo → `ACCOUNT_DISABLED`; éxito → contador a 0, `lockedUntil` nulo y sesión nueva), con el nombre de usuario sin espacios en los extremos y en minúsculas; `logout(sessionId)`; y `me(user)`, que devuelve `CurrentUser` con `homePath` de `ROLE_HOME`
- [X] T040 [US1] Implementar `apps/api/src/auth/auth.controller.ts`: `POST /auth/login` con `@Public()` y `ZodValidationPipe(loginRequestSchema)`, que fija la cookie `sid` (`HttpOnly`, `SameSite=Strict`, `Secure` según `COOKIE_SECURE`, `Path=/`, `Max-Age=43200`) y responde 200 con `CurrentUser`; `POST /auth/logout` → 204 y borra la cookie; `GET /auth/me` → `CurrentUser`. Registrar el controlador y `AuthService` en `apps/api/src/auth/auth.module.ts` (depende de T039)
- [X] T041 [P] [US1] Crear `apps/web/src/features/auth/session.ts` con `useCurrentUser()` (consulta `GET /api/auth/me`; un 401 devuelve `null` sin reintentar), `useLogin()` y `useLogout()` (mutaciones que actualizan o limpian la caché de TanStack Query)
- [X] T042 [US1] Crear `apps/web/src/features/auth/LoginPage.tsx` en `/ingresar`: título "Ingresar", campos "Usuario" (`autocapitalize="none"`, `autocomplete="username"`) y "Contraseña" (`type="password"`), botón "Ingresar" de al menos 44 px de alto, mensaje de error de la API o de red sin borrar lo escrito, redirección a `homePath` tras ingresar o si ya hay sesión, sin desplazamiento horizontal entre 768 y 1366 px (depende de T041)
- [X] T043 [P] [US1] Crear las pantallas iniciales `apps/web/src/features/role-home/WaiterHome.tsx` (`/mozo`), `apps/web/src/features/role-home/KitchenHome.tsx` (`/cocina`, texto de al menos 18 px) y `apps/web/src/features/role-home/CashierHome.tsx` (`/caja`), con el saludo "Hola, {nombre completo}" y una nota de que las funciones llegarán en próximas versiones; y `apps/web/src/features/users/UsersPage.tsx` con solo el encabezado "Gestión de usuarios" (lo completa US3)
- [X] T044 [US1] Crear `apps/web/src/app/AppShell.tsx` (encabezado con el nombre del usuario y el botón "Cerrar sesión" siempre visible, de al menos 44×44 px, FR-006) y `apps/web/src/features/auth/RequireAuth.tsx` (sin sesión, redirige a `/ingresar` con `replace`) (depende de T041)
- [X] T045 [US1] Conectar las rutas en `apps/web/src/app/router.tsx`: `/ingresar` pública; `/admin/usuarios`, `/mozo`, `/cocina` y `/caja` dentro de `RequireAuth` y `AppShell`. En `apps/web/src/app/providers.tsx`, manejar los 401 globales: limpiar la caché y navegar a `/ingresar` (depende de T042–T044)

**Checkpoint**: US1 funciona por sí sola. Pasan `auth.acceptance.spec.ts`, `LoginPage.test.tsx` y `login.spec.ts`.

---

## Phase 4: User Story 2 - Cada rol ve solo las pantallas de su función (Priority: P2)

**Goal**: mozo, cocina y cajero solo ven y abren las pantallas de su rol; el backend rechaza
operaciones de otros roles aunque no se use la interfaz; el administrador entra a todas.

**Independent Test**: con un usuario de cada rol, comprobar que el menú solo muestra su
opción, que abrir por dirección una pantalla de otro rol muestra "No tienes permiso para ver
esta pantalla" y que el administrador abre todas.

### Tests for User Story 2 ⚠️

- [X] T046 [P] [US2] Crear `apps/api/test/helpers/role-probe.controller.ts` (controlador solo para pruebas con un endpoint `GET` y uno `POST` por rol, marcados `@Roles(Role.WAITER)`, `@Roles(Role.KITCHEN)`, `@Roles(Role.CASHIER)` y `@Roles(Role.ADMIN)`, donde el `POST` incrementa un contador en memoria) y escribir `apps/api/test/acceptance/role-access.acceptance.spec.ts`: `[001] AC-2.3` (cada rol no administrador recibe 403 `FORBIDDEN` en los endpoints de los otros roles y el contador no cambia); `[001] AC-2.4` (cambiar en la base el rol de un usuario con sesión abierta hace que su siguiente petición use los permisos nuevos y que `GET /api/auth/me` devuelva el rol y el `homePath` nuevos); `[001] AC-2.5` (el administrador recibe 200 en los endpoints de todos los roles)
- [X] T047 [P] [US2] Escribir `apps/web/e2e/role-access.spec.ts` (en los dos proyectos de tablet): `[001] AC-2.1` (para cada rol, el menú muestra exactamente las opciones permitidas más "Cerrar sesión"); `[001] AC-2.2` (como mozo, abrir por dirección `/caja`, `/cocina` y `/admin/usuarios` muestra "No tienes permiso para ver esta pantalla", y "Volver a mi inicio" lleva a `/mozo`); `[001] AC-2.5` (el administrador abre `/mozo`, `/cocina` y `/caja`); `[001] AC-2.6` (mozo, cocina y cajero que abren `/admin/usuarios` ven el mensaje de permiso)
- [X] T048 [P] [US2] Escribir `apps/web/src/features/auth/RequireRole.test.tsx` (ruta no permitida → renderiza `ForbiddenPage` y no ejecuta las consultas de la pantalla pedida) y `apps/web/src/app/NavMenu.test.tsx` (opciones por rol según `APP_ROUTES`)

### Implementation for User Story 2

- [X] T049 [P] [US2] Crear `apps/web/src/features/auth/RequireRole.tsx` (usa `canAccess` de `@picanteria/shared`; si no hay permiso, renderiza `ForbiddenPage` sin montar la pantalla pedida) y `apps/web/src/features/auth/ForbiddenPage.tsx` (mensaje "No tienes permiso para ver esta pantalla" y botón "Volver a mi inicio", de al menos 44 px, que navega a `homePath`)
- [X] T050 [P] [US2] Crear `apps/web/src/app/NavMenu.tsx`: muestra las entradas de `APP_ROUTES` permitidas para el rol actual con las etiquetas "Usuarios", "Mozo", "Cocina" y "Caja", con áreas táctiles de al menos 44×44 px y sin depender de `hover`
- [X] T051 [US2] Integrar en `apps/web/src/app/AppShell.tsx` el `NavMenu` y en `apps/web/src/app/router.tsx` envolver cada ruta interna con `RequireRole` según `APP_ROUTES`; añadir `/sin-permiso` (renderiza `ForbiddenPage`) y redirigir las rutas inexistentes a `homePath`, o a `/ingresar` si no hay sesión ([contracts/ui-routes.md § Comportamiento](contracts/ui-routes.md)) (depende de T049, T050)
- [X] T052 [US2] En `apps/web/src/app/providers.tsx`, ante un `ApiError` con `code: "FORBIDDEN"`, invalidar `useCurrentUser` para que el menú y la protección de rutas reflejen el rol vigente (FR-012) y mostrar `ForbiddenPage`; activar `refetchOnWindowFocus` en `useCurrentUser` en `apps/web/src/features/auth/session.ts`

**Checkpoint**: US1 y US2 funcionan cada una por sí sola.

---

## Phase 5: User Story 3 - El administrador gestiona los usuarios (Priority: P3)

**Goal**: el administrador registra, edita, restablece contraseñas, desactiva y reactiva
usuarios, sin quedarse nunca sin un administrador activo; las desactivaciones y los cambios de
rol se reflejan al instante en las sesiones abiertas.

**Independent Test**: el administrador crea un usuario de cada rol, cambia el rol de uno,
restablece la contraseña de otro y desactiva un tercero, y en cada caso comprueba el efecto en
el ingreso de ese usuario.

### Tests for User Story 3 ⚠️

- [ ] T053 [P] [US3] Escribir `apps/api/test/acceptance/users.acceptance.spec.ts`: `[001] AC-3.1` (`POST /api/users` → 201, activo, puede ingresar); `[001] AC-3.2` (`Mozo1` cuando existe `mozo1` → 409 `USERNAME_TAKEN`); `[001] AC-3.3` (contraseña de 7 caracteres → 400 `VALIDATION_ERROR` con `details.password` en español); `[001] AC-3.4` (`PATCH` de `fullName` y `role` se refleja en `GET /api/users`); `[001] AC-3.5` (`PUT /password` → ingresa con la nueva y no con la anterior; también reinicia `failedLoginAttempts` y `lockedUntil`); `[001] AC-3.6` (`PATCH /status` con `isActive: false` → no puede ingresar, su sesión abierta recibe 401 y sigue en la lista como inactivo); `[001] AC-3.7` (reactivar → vuelve a ingresar con su contraseña); `[001] AC-3.8` (con un solo administrador activo: quitarse a sí mismo el rol de administrador → 409 `LAST_ADMIN` y desactivarse a sí mismo → 409 `CANNOT_DISABLE_SELF`; con dos administradores activos que se desactivan mutuamente en paralelo, una operación termina bien, la otra recibe 409 `LAST_ADMIN` y queda uno activo); `[001] AC-3.9` (ninguna respuesta contiene `passwordHash` ni `password`). Añadir casos sin ID: 404 `NOT_FOUND` para un ID inexistente y 403 `FORBIDDEN` en `/api/users` para mozo, cocina y cajero
- [ ] T054 [P] [US3] Escribir `apps/api/test/acceptance/realtime.acceptance.spec.ts` con `socket.io-client`: la conexión sin cookie válida se rechaza con `UNAUTHENTICATED`; `[001] AC-3.6` (al desactivar a un usuario, su socket recibe `auth:session-revoked` con `reason: "USER_DISABLED"` y se desconecta); `[001] AC-2.4` (al cambiar el rol, su socket recibe `auth:profile-changed` con `fields: ["role"]`); el logout envía `LOGGED_OUT` solo a los sockets de la sesión cerrada
- [ ] T055 [P] [US3] Escribir `apps/web/src/features/users/UserForm.test.tsx` (mensajes de validación en español: nombre de 2 a 100 caracteres, usuario de 3 a 30 caracteres permitidos, contraseña de al menos 8; muestra el error `USERNAME_TAKEN` de la API junto al campo) y `apps/web/src/features/users/UsersPage.test.tsx` (columnas "Nombre completo", "Usuario", "Rol" y "Estado"; desactivar abre un diálogo de confirmación y solo llama a la API al confirmar)
- [ ] T056 [P] [US3] Escribir `apps/web/e2e/users-admin.spec.ts`: `[001] AC-3.1` (crear un usuario desde la interfaz y que ingrese en otro contexto del navegador); `[001] AC-3.9` (la lista muestra nombre completo, usuario, rol y estado, sin contraseñas); `[001] AC-3.6` (desactivar con confirmación hace que la sesión abierta del usuario en otro contexto vuelva a `/ingresar` con el aviso "Tu cuenta fue desactivada. Consulta al administrador."); `[001] AC-2.4` (cambiar a Cajero el rol de un mozo conectado redibuja su menú y lo lleva a `/caja` sin volver a iniciar sesión)

### Implementation for User Story 3

- [ ] T057 [P] [US3] Crear `packages/shared/src/schemas/users.ts` según [data-model.md § User](data-model.md) y exportarlo desde `packages/shared/src/index.ts`: `createUserRequestSchema` (`fullName`: "Obligatorio; 2 a 100 caracteres tras quitar espacios en los extremos"; `username`: "se quitan espacios en los extremos y se guarda en minúsculas; 3 a 30 caracteres de `a-z`, `0-9`, `.`, `-`, `_`"; `password`: "8 a 128 caracteres"; `role`), `updateUserRequestSchema` (solo `fullName` y `role`, al menos uno), `setPasswordRequestSchema`, `setStatusRequestSchema` (`isActive` booleano) y `userSchema` (sin `passwordHash`), todos estrictos y con mensajes en español
- [ ] T058 [P] [US3] Crear `apps/api/src/realtime/realtime.gateway.ts` y `apps/api/src/realtime/realtime.module.ts` (importa `SessionsModule`): en el handshake, leer la cookie `sid` con `cookie.parse` y validarla con `SessionsService` (rechazar con `UNAUTHENTICATED` si no es válida); guardar `userId` y `sessionId` en `socket.data`; unir el socket a `user:<id>` y a `role:<ROL>` (el administrador, a todas las salas de rol); exponer `emitToUser(userId, event, payload)`, `emitToSession(sessionId, event, payload)` y `disconnectUser(userId)` ([contracts/websocket-events.md](contracts/websocket-events.md))
- [ ] T059 [US3] Implementar `apps/api/src/auth/users.service.ts`: `list()` ordenado por `fullName` y sin `passwordHash`; `create()` normaliza el nombre de usuario, aplica Argon2id y convierte el error de unicidad de Prisma (`P2002`) en 409 `USERNAME_TAKEN`; `update()` cambia `fullName` y `role` y, si quita el rol de administrador, verifica dentro de una transacción `Serializable` (con un reintento ante `P2034`) que quede al menos un administrador activo (si no, 409 `LAST_ADMIN`), y emite `auth:profile-changed` con los campos cambiados; `setPassword()` aplica el hash y reinicia `failedLoginAttempts = 0` y `lockedUntil = null`; `setStatus()` rechaza que el administrador se desactive a sí mismo (409 `CANNOT_DISABLE_SELF`), aplica la misma comprobación de último administrador y, al desactivar, llama a `revokeAllForUser`, emite `auth:session-revoked` con `reason: "USER_DISABLED"` y llama a `disconnectUser` ([research.md §9](research.md)) (depende de T057, T058)
- [ ] T060 [US3] Implementar `apps/api/src/auth/users.controller.ts` con `@Roles(Role.ADMIN)`: `GET /users`, `POST /users` (201), `PATCH /users/:id`, `PUT /users/:id/password` (204) y `PATCH /users/:id/status`, con `ZodValidationPipe` en cada cuerpo y 404 `NOT_FOUND` para un ID inexistente o con formato inválido; registrarlo junto con `UsersService` en `apps/api/src/auth/auth.module.ts`, que importa `RealtimeModule` ([contracts/rest-api.yaml](contracts/rest-api.yaml)) (depende de T059)
- [ ] T061 [US3] En `apps/api/src/auth/auth.service.ts`, al cerrar sesión, emitir `auth:session-revoked` con `reason: "LOGGED_OUT"` solo a los sockets de esa sesión mediante `emitToSession` (depende de T058)
- [ ] T062 [P] [US3] Crear `apps/web/src/lib/socket.ts` (cliente `socket.io-client` del mismo origen que se conecta cuando hay sesión y se desconecta al cerrarla) y `apps/web/src/features/auth/useRealtime.ts`: ante `auth:session-revoked`, limpiar la caché, desconectar y navegar a `/ingresar` (con `USER_DISABLED`, pasar el aviso "Tu cuenta fue desactivada. Consulta al administrador."); ante `auth:profile-changed`, invalidar `useCurrentUser` y, si la ruta actual ya no está permitida, navegar al nuevo `homePath`. Montar `useRealtime` en `apps/web/src/app/AppShell.tsx` y mostrar el aviso recibido en `apps/web/src/features/auth/LoginPage.tsx`
- [ ] T063 [P] [US3] Crear `apps/web/src/features/users/api.ts` con `useUsers`, `useCreateUser`, `useUpdateUser`, `useSetPassword` y `useSetStatus` (TanStack Query; cada mutación invalida `useUsers`)
- [ ] T064 [P] [US3] Crear `apps/web/src/features/users/UserForm.tsx` (alta y edición con react-hook-form y `zodResolver` sobre los esquemas de T057; en edición, el nombre de usuario no se puede cambiar; muestra junto al campo los errores `USERNAME_TAKEN`, `LAST_ADMIN` y `VALIDATION_ERROR` de la API)
- [ ] T065 [P] [US3] Crear `apps/web/src/features/users/PasswordDialog.tsx` ("Asignar contraseña nueva", mínimo 8 caracteres) y `apps/web/src/features/users/ConfirmDialog.tsx` (diálogo genérico con botones "Cancelar" y "Confirmar" de al menos 44 px; para desactivar, el texto "¿Desactivar a {nombre}? No podrá ingresar al sistema.", FR-022)
- [ ] T066 [US3] Completar `apps/web/src/features/users/UsersPage.tsx`: tabla con "Nombre completo", "Usuario", "Rol" (con `ROLE_LABELS`) y "Estado" ("Activo"/"Inactivo"); botón "Nuevo usuario"; por fila, "Editar", "Cambiar contraseña" y "Desactivar" (con `ConfirmDialog`) o "Reactivar"; muestra en español los errores `LAST_ADMIN` y `CANNOT_DISABLE_SELF` de la API (depende de T063–T065)

**Checkpoint**: las tres historias funcionan cada una por sí sola.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: verificar los requisitos de tablet, automatizar las puertas de calidad y validar la
feature completa.

- [ ] T067 [P] Escribir `apps/web/e2e/tablet.spec.ts` (en los dos proyectos de tablet) para SC-006, FR-024 y el Principio IV: en `/ingresar`, `/mozo` y `/cocina`, `document.documentElement.scrollWidth <= window.innerWidth`; todo botón, enlace y campo visible mide al menos 44×44 px; el texto principal de `/cocina` tiene `font-size` de al menos 18 px
- [ ] T068 [P] Crear `.github/workflows/ci.yml`, que en cada PR hacia `main` ejecuta `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` (con un servicio PostgreSQL 17 para `DATABASE_URL_TEST`) y `npm run check:ac -- 001`
- [ ] T069 [P] Crear `README.md` en la raíz con la descripción del proyecto, los requisitos y los enlaces a [quickstart.md](quickstart.md) y a la constitución
- [ ] T070 Revisar que todos los textos visibles en `apps/web/src/` y los mensajes de `packages/shared/src/errors.ts` y de los esquemas estén en español y usen el vocabulario de la picantería (Principio III)
- [ ] T071 Ejecutar desde la raíz los scripts de `package.json` `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` (con `docker compose up --build`) y `npm run check:ac -- 001`, y corregir hasta que todos terminen con código 0 y los 22 criterios `AC-x.y` figuren como cubiertos
- [ ] T072 Recorrer los 9 pasos manuales de [quickstart.md § Recorrido manual](quickstart.md) en viewport de tablet y corregir cualquier diferencia con lo esperado

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T001 y T002 primero; el resto en paralelo.
- **Foundational (Phase 2)**: depende de Setup y BLOQUEA todas las historias.
- **User Stories (Phase 3–5)**: dependen de Foundational. Pueden hacerse en paralelo o en
  orden de prioridad (P1 → P2 → P3).
- **Polish (Phase 6)**: depende de las tres historias.

### User Story Dependencies

- **US1 (P1)**: solo depende de Foundational.
- **US2 (P2)**: depende de Foundational. Sus pruebas de backend usan un controlador de pruebas
  propio (T046) y no necesitan los endpoints de US3. Sus pruebas extremo a extremo necesitan
  el ingreso y las pantallas iniciales de US1 (T042–T045).
- **US3 (P3)**: depende de Foundational. Su interfaz se monta dentro del `AppShell` de US1
  (T044) y en la ruta `/admin/usuarios` protegida por US2 (T051). T061 modifica un archivo de
  US1 (`auth.service.ts`).

### Within Each User Story

- Las pruebas se escriben primero y deben fallar antes de implementar.
- Esquemas compartidos → servicios → controladores → pantallas → integración.
- La historia se termina antes de pasar a la siguiente prioridad.

### Parallel Opportunities

- Setup: T003–T012 en paralelo tras T001 y T002.
- Foundational: T013–T016 y T018; luego T020–T025 y T027; luego T032 y T033.
- En cada historia, todas las tareas de prueba marcadas [P] en paralelo.
- US1: T041 y T043 en paralelo. US2: T049 y T050. US3: T057 y T058; luego T062–T065.
- Con varias personas, US1, US2 y US3 pueden avanzar a la vez tras Foundational, respetando
  los archivos compartidos indicados arriba.

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo (escribir primero, deben fallar):
Task: "T036 auth.acceptance.spec.ts en apps/api/test/acceptance/"
Task: "T037 LoginPage.test.tsx en apps/web/src/features/auth/"
Task: "T038 login.spec.ts en apps/web/e2e/"

# Piezas independientes de la implementación de US1:
Task: "T041 session.ts en apps/web/src/features/auth/"
Task: "T043 pantallas iniciales en apps/web/src/features/role-home/"
```

## Parallel Example: User Story 3

```bash
# Pruebas de US3 en paralelo:
Task: "T053 users.acceptance.spec.ts"
Task: "T054 realtime.acceptance.spec.ts"
Task: "T055 UserForm.test.tsx y UsersPage.test.tsx"
Task: "T056 users-admin.spec.ts"

# Base de la implementación de US3:
Task: "T057 schemas/users.ts en packages/shared"
Task: "T058 realtime.gateway.ts en apps/api/src/realtime/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup.
2. Completar Phase 2: Foundational (bloquea todas las historias).
3. Completar Phase 3: US1.
4. **Detenerse y validar**: pasan `auth.acceptance.spec.ts`, `LoginPage.test.tsx` y
   `login.spec.ts`; los cuatro usuarios de `seed-e2e` ingresan y llegan a su pantalla.
5. Hacer commit en la rama `001-base-comun` (sin abrir todavía el PR).

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → validar → commit (MVP: ya se puede ingresar).
3. US2 → validar → commit (acceso por rol).
4. US3 → validar → commit (el administrador gestiona al personal).
5. Polish → todas las puertas de calidad en verde → **un único PR** de `001-base-comun` hacia
   `main`.

### Parallel Team Strategy

Con varias personas, después de Foundational:

- Persona A: US1.
- Persona B: US2 (pruebas de backend con `role-probe`; e2e cuando US1 esté lista).
- Persona C: US3 (backend y tiempo real primero; interfaz cuando US1 y US2 estén listas).

---

## Notes

- [P] = archivos distintos y sin dependencias pendientes.
- La etiqueta [USn] traza cada tarea a su historia de [spec.md](spec.md).
- Cada prueba de aceptación lleva `[001] AC-x.y` en su título; `check:ac` lo verifica.
- Ningún secreto en el repositorio: solo `.env.example`. Las contraseñas de `seed-e2e.ts` son
  valores de prueba.
- Hacer commit tras cada tarea o grupo lógico, siempre en la rama `001-base-comun`.
- Evitar tareas vagas, conflictos en un mismo archivo y dependencias entre historias que rompan
  su independencia.
