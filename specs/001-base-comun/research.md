# Research: Base común — inicio de sesión, roles y gestión de usuarios

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-28

Cada decisión sigue el formato Decisión / Razón / Alternativas consideradas. Las bibliotecas
nuevas en el proyecto se justifican aquí, como exige la sección "Stack tecnológico y
restricciones" de la constitución.

## 1. Organización del monorepo

- **Decisión**: npm workspaces con tres paquetes: `apps/api` (NestJS), `apps/web` (React +
  Vite) y `packages/shared` (roles, esquemas de validación, códigos de error y nombres de
  eventos compartidos). Un `tsconfig.base.json` en la raíz con las opciones estrictas que
  heredan los tres.
- **Razón**: npm viene con Node, no exige instalar otra herramienta y basta para tres paquetes.
  `packages/shared` es la única fuente de los contratos tipados entre frontend y backend
  (Principio I).
- **Alternativas consideradas**: pnpm (más rápido, pero otra herramienta que instalar en cada
  máquina del equipo); Nx/Turborepo (orquestación innecesaria para tres paquetes); dos
  repositorios separados (duplica los tipos de los contratos).

## 2. TypeScript estricto y lint

- **Decisión**: `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch` en `tsconfig.base.json`. ESLint con `typescript-eslint` en modo
  `strictTypeChecked`, con `@typescript-eslint/no-explicit-any` y `ban-ts-comment` (permitiendo
  solo `@ts-expect-error` con descripción) como errores. NestJS añade
  `experimentalDecorators` y `emitDecoratorMetadata`, compatibles con el modo estricto.
- **Razón**: convierte el Principio I en una comprobación automática en lugar de una regla de
  revisión manual.
- **Alternativas consideradas**: `exactOptionalPropertyTypes` (descartado por fricción con los
  tipos generados por Prisma; puede activarse más adelante con una enmienda menor del plan).

## 3. Validación en tiempo de ejecución y contratos compartidos

- **Decisión**: esquemas Zod en `packages/shared` para cada petición y respuesta. El backend
  los aplica con un `ZodValidationPipe` propio; el frontend los reutiliza en los formularios
  (react-hook-form + `@hookform/resolvers/zod`). Los tipos TypeScript se derivan con
  `z.infer`. Las variables de entorno también se validan con Zod al arrancar.
- **Razón**: un solo esquema da el tipo estático y la validación en ambos extremos; los
  mensajes de validación se escriben una vez, en español (Principio III).
- **Alternativas consideradas**: `class-validator` + `class-transformer` (estándar en NestJS,
  pero no se comparte con el frontend y obliga a duplicar reglas); `nestjs-zod` (añade una
  dependencia para lo que resuelve un pipe de pocas líneas).

## 4. Modelo de sesión: sesiones en base de datos con cookie

- **Decisión**: al iniciar sesión se genera un token aleatorio de 32 bytes; se guarda solo su
  hash SHA-256 en la tabla `Session` y el token viaja en una cookie `HttpOnly`,
  `SameSite=Strict`, `Secure` en producción, con duración de 12 horas. Cada petición valida la
  sesión y vuelve a leer el usuario (estado y rol) desde la base de datos.
- **Razón**: la especificación exige que desactivar a un usuario o cambiar su rol tenga efecto
  en su **siguiente acción** (FR-012, SC-005, AC-2.4, AC-3.6) y que las sesiones expiren a las
  12 horas (FR-007). Con sesiones en base de datos, revocar es un `UPDATE`; además la entidad
  Sesión ya figura en la especificación. La carga es de unos pocos usuarios simultáneos, así
  que la consulta por petición no es un problema.
- **Alternativas consideradas**: JWT sin estado (no se puede revocar sin una lista negra, que
  reintroduce la consulta a base de datos); JWT corto + refresh token (más piezas para el mismo
  resultado); sesiones en Redis (otro servicio en Docker Compose sin necesidad a esta escala).

## 5. Protección CSRF

- **Decisión**: frontend y API se sirven desde el mismo origen (proxy de Vite en desarrollo,
  nginx en Docker Compose) y la cookie es `SameSite=Strict`. Las peticiones que modifican datos
  exigen además la cabecera `X-Requested-With: picanteria-web`, que un formulario de otro sitio
  no puede enviar.
- **Razón**: con mismo origen y `SameSite=Strict`, el navegador no envía la cookie en
  peticiones iniciadas desde otros sitios; la cabecera es una segunda barrera barata.
- **Alternativas consideradas**: tokens CSRF sincronizados (más complejidad sin beneficio real
  con mismo origen).

## 6. Hash de contraseñas

- **Decisión**: Argon2id con la biblioteca `argon2` (parámetros por defecto de la biblioteca,
  que cumplen la recomendación de OWASP). Longitud de contraseña entre 8 y 128 caracteres.
- **Razón**: es el algoritmo recomendado por OWASP para contraseñas; el límite superior evita
  peticiones con contraseñas enormes que consuman CPU.
- **Alternativas consideradas**: bcrypt (aceptable, pero trunca a 72 bytes y es la opción
  menos recomendada hoy); scrypt de `node:crypto` (sin dependencia, pero su configuración segura
  es menos evidente).

## 7. Bloqueo por intentos fallidos

- **Decisión**: el usuario guarda `failedLoginAttempts` y `lockedUntil`. Al quinto fallo
  consecutivo, `lockedUntil = ahora + 15 min`. Mientras dure el bloqueo, todo intento se
  rechaza con `ACCOUNT_LOCKED` sin verificar la contraseña y sin alargar el bloqueo. Un ingreso
  correcto o el vencimiento del bloqueo reinician el contador. Para usuarios inexistentes se
  verifica contra un hash ficticio, para que el tiempo de respuesta no revele si el usuario
  existe.
- **Orden de comprobación**: (1) usuario inexistente → `INVALID_CREDENTIALS`; (2) cuenta
  bloqueada → `ACCOUNT_LOCKED`; (3) contraseña incorrecta → `INVALID_CREDENTIALS` y suma un
  intento; (4) contraseña correcta pero usuario inactivo → `ACCOUNT_DISABLED`; (5) éxito.
- **Razón**: cumple FR-002, FR-003, FR-004, AC-1.3, AC-1.4 y AC-1.6. El mensaje de cuenta
  desactivada solo aparece con la contraseña correcta, así que no revela cuentas a quien no
  conoce la contraseña. El mensaje de bloqueo sí revela que la cuenta existe; la especificación
  lo pide explícitamente (AC-1.6) y se acepta.
- **Alternativas consideradas**: límite por IP con `@nestjs/throttler` (útil frente a ataques
  distribuidos; se deja para una feature de endurecimiento posterior porque la especificación
  define el bloqueo por cuenta).

## 8. Autorización por rol

- **Decisión**: un `SessionGuard` global (todas las rutas requieren sesión salvo las marcadas
  `@Public()`) y un `RolesGuard` con el decorador `@Roles(...)`. El rol `ADMIN` pasa cualquier
  comprobación de rol (FR-011); los endpoints de gestión de usuarios se marcan
  `@Roles(Role.ADMIN)`. La matriz rol → pantallas vive en `packages/shared/src/roles.ts` y la
  usan tanto el menú y las rutas del frontend como las pruebas de aceptación.
- **Razón**: el backend es la autoridad (AC-2.3: rechazar operaciones aunque no se use la
  interfaz); el frontend solo oculta lo que no corresponde. Una sola matriz evita que menú,
  rutas y API diverjan.
- **Alternativas consideradas**: CASL u otra biblioteca de permisos (excesiva para cuatro roles
  fijos sin permisos por recurso).

## 9. Último administrador y concurrencia

- **Decisión**: desactivar a un usuario o quitarle el rol de administrador se hace en una
  transacción interactiva de Prisma con aislamiento `Serializable`, contando los
  administradores activos restantes antes de confirmar. Un administrador no puede
  desactivarse a sí mismo (`CANNOT_DISABLE_SELF`).
- **Razón**: sin transacción serializable, dos administradores que se desactivan mutuamente al
  mismo tiempo podrían dejar el sistema sin ninguno (FR-019, AC-3.8). Ante un conflicto de
  serialización se reintenta una vez.
- **Alternativas consideradas**: `SELECT ... FOR UPDATE` con SQL crudo (equivalente, pero sale
  de la API tipada de Prisma).

## 10. Nombres de usuario

- **Decisión**: se eliminan los espacios al inicio y al final y se guardan en minúsculas; la
  restricción `UNIQUE` sobre la columna garantiza la unicidad sin distinguir mayúsculas. Formato
  permitido: 3 a 30 caracteres, letras sin tildes, números, punto, guion y guion bajo.
- **Razón**: cumple FR-014 y el caso borde de espacios. Guardar en minúsculas evita un índice
  funcional que Prisma no expresa en su esquema.
- **Alternativas consideradas**: tipo `citext` de PostgreSQL (requiere extensión y soporte
  parcial en Prisma); índice único sobre `lower(username)` con migración SQL manual.

## 11. Tiempo real con Socket.IO

- **Decisión**: un módulo de infraestructura `realtime` con un gateway de Socket.IO. En el
  handshake se lee la cookie de sesión y se valida igual que en HTTP; la conexión sin sesión
  válida se rechaza. Cada socket se une a las salas `user:<id>` y `role:<rol>`. En esta feature
  solo se emiten dos eventos: `auth:session-revoked` (el frontend vuelve a la pantalla de
  ingreso) y `auth:profile-changed` (el frontend vuelve a pedir el perfil y redibuja el menú).
  Las features de pedidos y cocina reutilizarán las salas por rol.
- **Razón**: deja autenticado el canal que usarán las demás features y hace visible al instante
  una desactivación o un cambio de rol, además de la comprobación por petición (que sigue siendo
  la garantía).
- **Alternativas consideradas**: WebSocket nativo (`ws`) (sin reconexión automática ni salas);
  Server-Sent Events (unidireccional; las features de pedidos necesitarán ambos sentidos).

## 12. Frontend

- **Decisión**: React 19 + Vite, React Router (modo biblioteca) con un componente
  `RequireRole` por ruta, TanStack Query para el estado del servidor (perfil, lista de
  usuarios), react-hook-form + Zod para formularios, Tailwind CSS para estilos y el cliente
  `socket.io-client`. Rutas en español: `/ingresar`, `/mozo`, `/cocina`, `/caja`,
  `/admin/usuarios`.
- **Razón**: TanStack Query resuelve caché, reintentos e invalidación sin un gestor de estado
  global. Tailwind facilita aplicar reglas de tablet consistentes (áreas táctiles de 44 px,
  tipografía de cocina ≥ 18 px) mediante tokens del tema (Principio IV).
- **Alternativas consideradas**: Redux Toolkit (innecesario: casi todo el estado es del
  servidor); una biblioteca de componentes completa como MUI (más peso y estilos de escritorio
  que habría que adaptar a tablet).

## 13. Estrategia de pruebas

- **Decisión**:
  - **API**: Jest + Supertest contra una base PostgreSQL real de pruebas (`picanteria_test`),
    con las migraciones aplicadas (`prisma migrate deploy`) antes de las suites y las tablas
    vaciadas antes de cada prueba. Por seguridad, solo se ejecutan contra bases cuyo nombre
    termina en `_test`. Aquí viven las pruebas de los criterios del
    lado servidor (AC-1.x, AC-2.3, AC-2.4, AC-3.x).
  - **Web**: Vitest + React Testing Library + MSW para componentes y hooks.
  - **Extremo a extremo**: Playwright con perfiles de tablet de 768×1024 (vertical) y
    1366×1024 (horizontal) contra la aplicación levantada con Docker Compose. Aquí viven los
    criterios visibles (AC-1.7, AC-2.1, AC-2.2, AC-2.5, AC-2.6, AC-3.9) y SC-006.
  - **Trazabilidad**: el título de cada prueba de aceptación empieza con el número de la
    feature y el ID del criterio (`"[001] AC-1.3: …"`). El prefijo es necesario porque todas
    las features usan el formato acordado `AC-<historia>.<n>` y los ID se repiten entre ellas.
    El script `scripts/check-ac-coverage.ts` extrae los ID de cada `specs/NNN-*/spec.md` y
    falla si alguno no aparece como `[NNN] AC-x.y` en ninguna prueba. Acepta números de
    feature como argumentos (`npm run check:ac -- 001`); sin argumentos revisa solo las
    features que ya tienen al menos una prueba etiquetada.
- **Razón**: cumple el Principio II de forma verificable. Jest es el corredor por defecto de
  NestJS; probar contra PostgreSQL real evita falsos positivos de mocks en transacciones y
  restricciones únicas.
- **Alternativas consideradas**: Vitest también en la API (exige plugin SWC para los
  metadatos de decoradores); Testcontainers (más lento y frágil con Docker en Windows que una
  base de pruebas en el mismo Compose).

## 14. Docker Compose

- **Decisión**: servicios `db` (PostgreSQL 17, con las bases `picanteria` y `picanteria_test`
  creadas por un script de inicio), `api` (NestJS; aplica `prisma migrate deploy` y la semilla
  del administrador inicial al arrancar) y `web` (nginx sirviendo el build de Vite y haciendo
  proxy de `/api` y `/socket.io` hacia `api`). En desarrollo se puede levantar solo `db` y
  ejecutar las apps con `npm run dev`.
- **Razón**: un solo origen para cookies y WebSockets, entorno reproducible para el equipo y
  para las pruebas extremo a extremo.
- **Alternativas consideradas**: servir el frontend desde NestJS (acopla los despliegues).

## 15. Administrador inicial

- **Decisión**: la semilla de Prisma crea un administrador si no existe ninguno, con
  `INITIAL_ADMIN_USERNAME` e `INITIAL_ADMIN_PASSWORD` leídos del entorno. Si ya existe un
  administrador, no hace nada.
- **Razón**: cumple el supuesto "el administrador inicial se crea durante la instalación" sin
  guardar credenciales en el repositorio (constitución, sección de stack).
- **Alternativas consideradas**: pantalla de "primer uso" que crea el administrador (expone
  una ruta pública sensible); comando de consola aparte (un paso más en la instalación).

## Resumen de dependencias nuevas

| Paquete | Dónde | Justificación |
|---------|-------|---------------|
| `prisma`, `@prisma/client` | api | ORM y migraciones versionadas (pedido del usuario; constitución exige migraciones) |
| `zod` | shared, api, web | Validación en tiempo de ejecución y tipos compartidos (Principio I) |
| `argon2` | api | Hash de contraseñas recomendado por OWASP |
| `cookie-parser`, `cookie` | api | Lectura de la cookie de sesión en HTTP y en el handshake de Socket.IO |
| `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` | api | Canal de tiempo real (pedido del usuario) |
| `socket.io-client` | web | Cliente del canal de tiempo real |
| `react-router` | web | Rutas y protección por rol |
| `@tanstack/react-query` | web | Estado del servidor y caché |
| `react-hook-form`, `@hookform/resolvers` | web | Formularios con validación Zod |
| `tailwindcss` | web | Estilos y tokens para tablet (Principio IV) |
| `jest`, `supertest`, `socket.io-client` | api (dev) | Pruebas de aceptación del servidor y del canal de tiempo real (Principio II) |
| `tsx`, `concurrently` | raíz (dev) | Ejecutar `scripts/check-ac-coverage.ts` y levantar api y web a la vez con `npm run dev` |
| `vitest`, `@testing-library/react`, `msw` | web | Pruebas de componentes |
| `@playwright/test` | web | Pruebas extremo a extremo en viewport de tablet |
