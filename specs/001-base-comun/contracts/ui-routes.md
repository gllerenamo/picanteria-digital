# Contrato de pantallas y acceso por rol

**Feature**: 001-base-comun

Esta matriz es la fuente única que usan el menú del frontend, la protección de rutas
(`RequireRole`) y las pruebas de aceptación. Se implementa en
`packages/shared/src/roles.ts`.

## Rutas

| Ruta | Pantalla | ADMIN | WAITER | KITCHEN | CASHIER | Notas |
|------|----------|:-----:|:------:|:-------:|:-------:|-------|
| `/ingresar` | Inicio de sesión | pública | pública | pública | pública | Con sesión válida, redirige a la pantalla inicial del rol. |
| `/admin/usuarios` | Gestión de usuarios | ✅ inicial | ❌ | ❌ | ❌ | AC-2.6, Historia 3. |
| `/mozo` | Inicio de mozo | ✅ | ✅ inicial | ❌ | ❌ | Optimizada para tablet. |
| `/cocina` | Inicio de cocina | ✅ | ❌ | ✅ inicial | ❌ | Optimizada para tablet; texto ≥ 18 px. |
| `/caja` | Inicio de caja | ✅ | ❌ | ❌ | ✅ inicial | |
| `/sin-permiso` | Acceso denegado | ✅ | ✅ | ✅ | ✅ | Mensaje "No tienes permiso para ver esta pantalla" y botón "Volver a mi inicio". |

En esta feature, `/mozo`, `/cocina` y `/caja` son pantallas iniciales con el saludo al
usuario y el menú; su contenido llegará con las features de pedidos, cocina y caja.

## Comportamiento de la protección de rutas

| Situación | Resultado | Criterio |
|-----------|-----------|----------|
| Sin sesión, cualquier ruta interna | Redirige a `/ingresar` (y tras ingresar, a la pantalla inicial del rol) | AC-1.7 |
| Sesión válida, ruta no permitida para el rol | Muestra `/sin-permiso` sin cargar datos de la pantalla pedida | AC-2.2, AC-2.6 |
| Sesión válida, ruta permitida | Muestra la pantalla | AC-2.5 |
| Ruta inexistente | Redirige a la pantalla inicial del rol (o a `/ingresar` sin sesión) | — |

## Menú de navegación

El menú muestra solo las rutas con ✅ para el rol del usuario (AC-2.1), más "Cerrar sesión"
siempre visible (FR-006). Etiquetas: "Usuarios", "Mozo", "Cocina", "Caja", "Cerrar sesión".

## Requisitos de tablet (Principio IV)

Se aplican a `/ingresar`, `/mozo` y `/cocina` (FR-024, SC-006), y se verifican con Playwright
en 768×1024 y 1366×1024:

- Sin desplazamiento horizontal.
- Elementos interactivos de al menos 44×44 px.
- Nada depende de `hover`.
- El formulario de ingreso abre el teclado adecuado (`autocapitalize="none"` en usuario,
  `type="password"` en contraseña) y se envía con la tecla Intro.
