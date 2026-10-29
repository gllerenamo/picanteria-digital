# Data Model: Módulo Carta y Catálogo de Mesas

**Feature**: `002-carta`

Este documento define las entidades gestionadas por el módulo de Carta, junto con el catálogo de mesas asumido según acuerdo del equipo.

```mermaid
erDiagram
    MENU_CATEGORY ||--o{ MENU_ITEM : "contiene"
    DINING_TABLE ||--o{ ORDER : "recibe (módulo 2)"
    MENU_ITEM ||--o{ ORDER_ITEM : "se referencia como (módulo 2)"

    MENU_CATEGORY {
        uuid id PK
        string name "único, 2 a 50 caracteres"
        int sortOrder "orden visual"
        boolean isActive "por defecto true"
        datetime createdAt
        datetime updatedAt
    }

    MENU_ITEM {
        uuid id PK
        uuid categoryId FK "referencia MENU_CATEGORY"
        string name "3 a 80 caracteres"
        string description "opcional, hasta 255 caracteres"
        decimal price "soles, 2 decimales, mayor a 0"
        boolean isAvailable "disponibilidad del día"
        boolean isActive "baja lógica"
        datetime createdAt
        datetime updatedAt
    }

    DINING_TABLE {
        uuid id PK
        int tableNumber "único, número de mesa (1..99)"
        int capacity "número de personas (1..20)"
        string status "LIBRE, OCUPADA, POR_COBRAR"
        datetime createdAt
        datetime updatedAt
    }
```

## Reglas de Integridad

1. **Unicidad de categoría**: El nombre de categoría es único (case-insensitive) para evitar categorías repetidas.
2. **Unicidad de plato por categoría**: No pueden existir dos platos activos con el mismo nombre dentro de la misma categoría.
3. **Baja lógica**: Los platos y categorías nunca se eliminan físicamente mediante `DELETE` para mantener la integridad referencial histórica con comandas y ventas de cocina/caja. Se marcan con `isActive = false`.
4. **Disponibilidad dinámica (`isAvailable`)**: Modificable en tiempo real. Un plato inactivo (`isActive = false`) no puede figurar como disponible.
5. **Catálogo de Mesas**: Cada mesa tiene un `tableNumber` único y su estado por defecto es `LIBRE`.
