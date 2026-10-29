# Contrato de Pantallas: Módulo Carta

**Feature**: `002-carta`

## Pantallas incorporadas

| Ruta | Etiqueta | Roles permitidos | Descripción |
|---|---|---|---|
| `/admin/carta` | Carta | `ADMIN` | Gestión completa de categorías, platos, precios y disponibilidad rápida. |
| `/carta` | Carta | `ADMIN`, `WAITER`, `KITCHEN`, `CASHIER` | Vista de consulta operativa de la carta para personal de sala y cocina. |

Las rutas se registran en `packages/shared/src/roles.ts` (`APP_ROUTES`) como exige la constitución.
