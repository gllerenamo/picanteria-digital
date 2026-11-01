# Implementation Plan: Caja y reportes

**Branch**: `005-caja-reportes` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-caja-reportes/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Caja cierra el ciclo de atención de cada mesa: el cajero ve en vivo las mesas por cobrar, cobra
la cuenta completa o dividida (en partes iguales o por ítems) con efectivo, Yape/Plin o tarjeta,
y al completar el pago libera la mesa. Al final de la jornada hace el cierre con conteo a ciegas
por método. El administrador consulta reportes de ventas y el ranking de platos.

Enfoque técnico: un módulo NestJS `billing` que **no duplica** el pedido: calcula la cuenta con
las funciones de la 003 (`consumptionCents`), serializa los cobros con su bloqueo de fila
(`lockOpenOrder`), libera la mesa con su `TablesService.transition` y evita pagos duplicados con
su decorador `IdempotencyKey`. Cinco tablas nuevas (`payments`, `bill_splits`, `bill_parts`,
`bill_part_items`, `day_closures`), una migración, reportes agregados en SQL y el evento nuevo
`billing:account-updated`. Detalle en [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.x estricto; Node.js 22 LTS (igual que el monorepo).

**Primary Dependencies**: las existentes (NestJS 11, Prisma 6, Socket.IO 4, Zod, React 19,
TanStack Query, react-hook-form, Tailwind). Sin dependencias nuevas.

**Storage**: PostgreSQL 17; nueva migración `20261029000004_billing` con tablas, índices
parciales y `CHECK` escritos a mano donde Prisma no los expresa.

**Testing**: Jest + Supertest contra `picanteria_test` (aceptación de la API, con
`createBillableOrder` para fijar casos exactos); pruebas unitarias de las funciones puras de
cálculo (división, cierre); Vitest + Testing Library (componentes); Playwright en tablet (e2e
con el flujo real de la 003: tomar, enviar y pedir la cuenta).

**Target Platform**: navegador en la computadora o tablet de caja; navegador de escritorio para
reportes; servidor en Docker.

**Project Type**: aplicación web (monorepo existente).

**Performance Goals**: cobro de una cuenta en menos de 1 min para el usuario (SC-001); mesa libre
visible para los mozos en menos de 3 s (SC-006); reportes de un año en menos de 3 s (SC-007).

**Constraints**: cero errores de redondeo (céntimos enteros); nunca cobrar dos veces el mismo
pago (`Idempotency-Key`); el total de caja siempre igual al consumo que ve el mozo.

**Scale/Scope**: un local, ~12 mesas, ~150 cuentas por día, ~55 000 al año. 5 pantallas, 11
endpoints, 1 evento nuevo, 30 criterios de aceptación.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Regla de la constitución | Cómo la cumple este plan | Estado |
|--------------------------|--------------------------|--------|
| **I. TypeScript estricto** | Esquemas Zod en `packages/shared/src/schemas/billing.ts` para cada petición y respuesta; filas de `$queryRaw` tipadas; montos en céntimos enteros. | ✅ |
| **II. Pruebas de criterios de aceptación** | Los 30 `AC-x.y` tienen capa asignada (tabla abajo); títulos `[005] AC-x.y`; se agrega `005` al paso `check:ac` del CI. | ✅ |
| **III. Interfaz en español** | Mensajes de los 11 códigos de error nuevos en `ERROR_MESSAGES`; etiquetas Efectivo, Yape/Plin, Tarjeta; `S/ 0.00` y fechas día/mes/año. | ✅ |
| **IV. Tablet para mozo y cocina** | Caja no es vista de mozo ni cocina, pero sigue las mismas reglas (44 px, sin scroll horizontal desde 768 px) y la liberación de mesa llega en vivo a la vista del mozo. | ✅ |
| **Stack** | Mismo stack; migración versionada; sin secretos nuevos. | ✅ |
| **Flujo y puertas de calidad** | Rama `005-caja-reportes`, un PR al terminar; typecheck, lint, pruebas y `check:ac -- 005`. | ✅ |

**Resultado previo a Phase 0**: sin violaciones.
**Re-evaluación tras Phase 1**: el diseño (cuenta calculada, bloqueo compartido con la 003,
idempotencia, cierre por `closureId`) mantiene todo en ✅.

### Asignación de criterios de aceptación a capas de prueba

| Criterios | Capa | Ubicación prevista |
|-----------|------|--------------------|
| AC-1.2 a AC-1.6, AC-1.8 (API) | API | `apps/api/test/acceptance/billing-accounts.acceptance.spec.ts` |
| AC-1.1, AC-1.7 | API + tiempo real | `apps/api/test/acceptance/billing-realtime.acceptance.spec.ts` |
| AC-2.1 a AC-2.7 | API | `apps/api/test/acceptance/billing-split.acceptance.spec.ts` |
| AC-3.1 a AC-3.6 | API | `apps/api/test/acceptance/billing-closures.acceptance.spec.ts` |
| AC-4.1 a AC-4.5, AC-5.1 a AC-5.4 | API | `apps/api/test/acceptance/reports.acceptance.spec.ts` |
| AC-1.1, AC-1.3, AC-1.8, AC-2.1, AC-3.2, AC-4.5 (interfaz) | Extremo a extremo | `apps/web/e2e/billing.spec.ts`, `apps/web/e2e/reports.spec.ts` |

Cálculos puros (reparto en partes iguales, validación de asignación por ítems, diferencias del
cierre) con pruebas unitarias en `apps/api/src/billing/*.spec.ts`.

## Project Structure

### Documentation (this feature)

```text
specs/005-caja-reportes/
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1: diagrama ER y entidades nuevas
├── quickstart.md        # Phase 1
├── contracts/
│   ├── rest-api.yaml          # Endpoints de caja y reportes
│   ├── websocket-events.md    # Eventos que escucha y emite Caja
│   ├── ui-routes.md           # Pantallas y acceso por rol
│   └── dependencias-003.md    # Qué usa de la 003 y qué le falta
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/shared/src/
├── schemas/billing.ts       # PaymentMethod, CreatePayment, CreateSplit, ClosureCounts, AccountDetail, SalesReport, TopDish…
├── errors.ts                # + 11 códigos de Caja con mensaje en español
├── events.ts                # + billing:account-updated
└── roles.ts                 # + /admin/reportes (solo ADMIN)

apps/api/
├── prisma/
│   ├── schema.prisma        # + Payment, BillSplit, BillPart, BillPartItem, DayClosure y enums
│   ├── migrations/20261029000004_billing/
│   └── seed-e2e.ts          # + mesas por cobrar con consumo para las e2e
├── src/billing/
│   ├── billing.module.ts
│   ├── accounts.controller.ts   # /billing/accounts…
│   ├── closures.controller.ts   # /billing/closures…
│   ├── reports.controller.ts    # /reports… (@Roles('ADMIN'))
│   ├── accounts.service.ts      # cuenta, pagos, anulación, cierre sin cobro
│   ├── splits.service.ts        # división
│   ├── closures.service.ts      # cierre del día
│   ├── reports.service.ts       # agregaciones SQL
│   ├── billing-math.ts          # reparto, asignación, diferencias (puras)
│   ├── billing-math.spec.ts
│   └── account-mapper.ts        # respuestas AccountDetail
└── test/
    ├── acceptance/billing-*.acceptance.spec.ts, reports.acceptance.spec.ts
    └── helpers/billing-factories.ts   # createBillableOrder, payWith…

apps/web/src/features/
├── billing/
│   ├── api.ts, useBillingRealtime.ts
│   ├── PendingAccountsPage.tsx  # /caja
│   ├── AccountPage.tsx          # /caja/cuentas/:orderId
│   ├── PaymentForm.tsx, SplitDialog.tsx, VoidPaymentDialog.tsx
│   ├── ClosurePage.tsx          # /caja/cierre
│   └── ClosuresHistoryPage.tsx  # /caja/cierres
└── reports/
    ├── api.ts
    └── ReportsPage.tsx          # /admin/reportes (ventas y platos)

apps/web/e2e/billing.spec.ts, reports.spec.ts
```

**Structure Decision**: el monorepo existente; el dominio de Caja vive en el módulo `billing`
(uno de los cinco módulos de dominio definidos en la 001). `CashierHome` de la 001 se reemplaza
por `PendingAccountsPage` en `/caja`. La 003 no se modifica salvo para importar sus funciones
públicas ([contracts/dependencias-003.md](contracts/dependencias-003.md)).

## Complexity Tracking

No hay violaciones de la constitución que justificar.
