# Quickstart: validar la feature 001-base-comun

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Guía para levantar el sistema y comprobar de extremo a extremo que la feature funciona. Los
comandos se definen en los `package.json` durante la implementación; aquí se documenta el
resultado esperado.

## Requisitos previos

- Node.js 22 LTS y npm 10 o superior.
- Docker Desktop con Docker Compose v2.
- Navegadores de Playwright instalados (`npx playwright install` en `apps/web`).

## 1. Configuración

```bash
cp .env.example .env
```

Variables relevantes (ver `.env.example`):

| Variable | Uso |
|----------|-----|
| `POSTGRES_USER`, `POSTGRES_PASSWORD` | Credenciales del PostgreSQL de Docker Compose, publicado en el puerto **5433** del host para no chocar con un PostgreSQL local. |
| `DATABASE_URL` | Base principal `picanteria` (`localhost:5433` fuera de Docker). |
| `DATABASE_URL_TEST` | Base de pruebas `picanteria_test`; las pruebas se niegan a correr si el nombre no termina en `_test`. |
| `INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_PASSWORD` | Administrador inicial que crea la semilla ([research.md §15](research.md)). |
| `COOKIE_SECURE` | `false` en desarrollo local, `true` en producción. |

## 2. Levantar el sistema

Todo con Docker Compose:

```bash
docker compose up --build
```

**Resultado esperado**: `db`, `api` y `web` quedan en marcha; `api` aplica las migraciones y
crea el administrador inicial; la aplicación responde en `http://localhost:8080`.

Alternativa para desarrollo (solo la base en Docker):

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

**Resultado esperado**: la API en `http://localhost:3000` y el frontend de Vite en
`http://localhost:5173`, con proxy de `/api` y `/socket.io` hacia la API.

## 3. Comprobaciones automáticas

| Comando | Qué verifica | Principio |
|---------|--------------|-----------|
| `npm run typecheck` | Compilación TypeScript sin errores en los tres paquetes | I |
| `npm run lint` | Sin `any`, sin `@ts-ignore` | I |
| `npm run test --workspace apps/api` | Pruebas unitarias y de aceptación del servidor contra `picanteria_test` | II |
| `npm run test --workspace apps/web` | Pruebas de componentes | II |
| `npm run test:e2e` | Playwright en 768×1024 y 1366×1024 con Docker Compose levantado | II, IV |
| `npm run check:ac` | Cada `AC-x.y` de [spec.md](spec.md) aparece en al menos una prueba | II |

**Resultado esperado**: todos terminan con código 0. `check:ac` lista los 22 criterios como
cubiertos.

## 4. Recorrido manual

Usar una tablet o el modo de dispositivo del navegador (768×1024).

1. **Ingreso del administrador**: entrar con el administrador inicial → aparece
   `/admin/usuarios` con el menú "Usuarios, Mozo, Cocina, Caja, Cerrar sesión" (AC-1.2,
   AC-2.1).
2. **Registrar personal**: crear `mozo1` (Mozo), `cocina1` (Cocina) y `caja1` (Cajero) con
   contraseña de 8 caracteres → aparecen activos en la lista, sin contraseñas visibles
   (AC-3.1, AC-3.9). Intentar crear `Mozo1` → "El nombre de usuario ya existe" (AC-3.2).
3. **Acceso por rol**: en otra ventana privada, entrar como `mozo1` → `/mozo`, el menú solo
   muestra "Mozo" y "Cerrar sesión" (AC-1.1, AC-2.1). Escribir `/caja` en la barra →
   "No tienes permiso para ver esta pantalla" (AC-2.2).
4. **Cambio de rol en vivo**: como administrador, cambiar `mozo1` a Cajero → la ventana de
   `mozo1` redibuja el menú y pasa a `/caja` sin volver a iniciar sesión (AC-2.4).
5. **Desactivación en vivo**: desactivar `mozo1` (confirmar el diálogo) → su ventana vuelve a
   `/ingresar` con el aviso de cuenta desactivada; intentar entrar de nuevo muestra el mismo
   aviso (AC-3.6, AC-1.4).
6. **Bloqueo**: fallar 5 veces la contraseña de `cocina1` → el sexto intento, aun con la
   contraseña correcta, informa que la cuenta está bloqueada (AC-1.6).
7. **Último administrador**: intentar desactivar al administrador inicial siendo el único →
   "No puedes desactivar tu propia cuenta"; cambiar su rol → "Debe existir al menos un
   administrador activo" (AC-3.8).
8. **Cierre de sesión**: "Cerrar sesión" → `/ingresar`; el botón Atrás del navegador no
   muestra pantallas internas (AC-1.5, AC-1.7).
9. **Orientación**: girar la tablet (1366×1024 o 1024×768) en `/ingresar`, `/mozo` y
   `/cocina` → sin desplazamiento horizontal (SC-006).

## Referencias

- Contrato HTTP: [contracts/rest-api.yaml](contracts/rest-api.yaml)
- Eventos de tiempo real: [contracts/websocket-events.md](contracts/websocket-events.md)
- Rutas y matriz de acceso: [contracts/ui-routes.md](contracts/ui-routes.md)
- Modelo de datos: [data-model.md](data-model.md)
