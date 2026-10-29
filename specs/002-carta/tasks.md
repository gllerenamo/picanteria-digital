# Tasks: Módulo Carta (002-carta)

Lista de tareas para la implementación del Módulo 1 (Carta), ordenadas según la constitución y el flujo de Spec Kit.

## Phase 1: Esquemas y Modelo de Datos

- [x] **T001** [P] Definir esquemas Zod y tipos TypeScript compartidos para categorías, platos y mesas en `packages/shared/src/schemas/menu.ts`, y exportarlos en `packages/shared/src/index.ts`.
- [x] **T002** [P] Agregar modelos `MenuCategory`, `MenuItem` y `DiningTable` a `apps/api/prisma/schema.prisma` y generar migración Prisma `20261029000001_menu_and_tables`.
- [x] **T003** [P] Registrar ruta `/admin/carta` en `packages/shared/src/roles.ts` (`APP_ROUTES`).

## Phase 2: Backend e Integración de Criterios de Aceptación

- [x] **T004** Escribir suite de pruebas de aceptación de la API en `apps/api/test/acceptance/menu.acceptance.spec.ts` referenciando todos los criterios:
  - `[002] AC-1.1`: Creación exitosa de plato por administrador.
  - `[002] AC-1.2`: Rechazo de creación con precio negativo o nombre vacío.
  - `[002] AC-1.3`: Rechazo de nombre duplicado en la misma categoría.
  - `[002] AC-1.4`: Actualización de plato existente.
  - `[002] AC-1.5`: Baja lógica de plato (`isActive = false`).
  - `[002] AC-1.6`: Rechazo a roles no administradores con código 403.
  - `[002] AC-2.1`: Conmutación rápida a no disponible (`isAvailable = false`).
  - `[002] AC-2.2`: Filtro para excluir platos no disponibles.
  - `[002] AC-2.3`: Reactivación de disponibilidad inmediata.
  - `[002] AC-2.4`: Inmutabilidad de pedidos previos ante cambio de disponibilidad.
  - `[002] AC-3.1`: Ordenamiento de categorías según `sortOrder`.
  - `[002] AC-3.2`: Creación de categoría por administrador.
  - `[002] AC-3.3`: Rechazo de categoría con nombre duplicado.
  - `[002] AC-3.4`: Consulta jerárquica de categorías con sus platos activos.
  - `[002] AC-4.1`: Formato en soles peruanos (`S/`) y datos para todos los roles autenticados.
  - `[002] AC-4.2`: Filtrado por categoría en consulta de carta.
  - `[002] AC-4.3`: Exposición del catálogo de mesas iniciales del local.
- [x] **T005** Implementar `MenuService` y `TablesService` en `apps/api/src/menu/` con validación y reglas de negocio.
- [x] **T006** Implementar `MenuController` y `TablesController` con protección de roles (`@Roles('ADMIN')`, etc.) y decoradores de autenticación.

## Phase 3: Frontend y Componentes

- [x] **T007** Implementar cliente API para carta en `apps/web/src/features/menu/api.ts`.
- [x] **T008** Implementar componentes de interfaz `MenuPage.tsx` y modal de plato con formulario en español y tokens tablet en `apps/web/src/features/menu/`.
- [x] **T009** Escribir pruebas unitarias de interfaz en `apps/web/src/features/menu/MenuPage.test.tsx`.

## Phase 4: Semillas, Datos de Ejemplo y Puertas de Calidad

- [x] **T010** Implementar datos de ejemplo arequipeños (Rocoto Relleno, Pastel de Papa, Chupe de Camarones, Adobo, Ocopa, Solterito, Chicha de Jora, Kola Escocesa, Queso Helado) y 12 mesas en `apps/api/prisma/seed.ts` y `seed-e2e.ts`.
- [x] **T011** Agregar `002` a `.github/workflows/ci.yml` en el comando `check:ac`.
- [x] **T012** Ejecutar puertas de calidad (`check:ac`, `typecheck`, `lint`, `test`) y confirmar 100% verde.
