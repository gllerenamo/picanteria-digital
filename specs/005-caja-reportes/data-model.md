# Data Model: Caja y reportes

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-29

Caja agrega cinco entidades (`Payment`, `BillSplit`, `BillPart`, `BillPartItem`, `DayClosure`)
y reutiliza sin modificar las de la 003 ([003 data-model](../003-mesas-pedidos/data-model.md)).
La "cuenta" no es una tabla: se calcula a partir del pedido ([research.md §2](research.md)).

## 1. Diagrama entidad-relación

Las entidades de la 003 y la 001 aparecen solo con los campos que Caja usa.

```mermaid
erDiagram
    USER ||--o{ PAYMENT : "registra (cajero)"
    USER ||--o{ PAYMENT : "anula"
    USER ||--o{ BILL_SPLIT : "divide"
    USER ||--o{ DAY_CLOSURE : "cierra"
    DINING_TABLE ||--o{ ORDER : "recibe"
    ORDER ||--|{ ORDER_ITEM : "contiene"
    MENU_ITEM ||--o{ ORDER_ITEM : "se pide como"
    ORDER ||--o{ PAYMENT : "se paga con"
    ORDER ||--o{ BILL_SPLIT : "se divide en"
    BILL_SPLIT ||--|{ BILL_PART : "tiene"
    BILL_PART ||--o{ BILL_PART_ITEM : "agrupa"
    ORDER_ITEM ||--o{ BILL_PART_ITEM : "se asigna en"
    BILL_PART ||--o{ PAYMENT : "se paga con"
    DAY_CLOSURE ||--o{ PAYMENT : "incluye"

    ORDER {
        uuid id PK "003"
        uuid tableId FK
        uuid waiterId FK
        enum status "OPEN | PAID | CANCELLED"
        datetime closedAt "nullable; Caja lo fija al cobrar"
    }

    ORDER_ITEM {
        uuid id PK "003"
        uuid orderId FK
        uuid menuItemId FK
        int quantity
        int voidedQuantity
        decimal unitPrice "fijado al enviar"
        enum status "DRAFT | PENDING | PREPARING | READY | VOIDED"
    }

    DINING_TABLE {
        uuid id PK "003"
        int tableNumber UK
        enum status "LIBRE | OCUPADA | POR_COBRAR"
    }

    MENU_ITEM {
        uuid id PK "002"
        string name
    }

    USER {
        uuid id PK "001"
        string fullName
        enum role
    }

    PAYMENT {
        uuid id PK
        uuid orderId FK
        uuid partId FK "nullable"
        uuid closureId FK "nullable hasta el cierre"
        enum method "CASH | YAPE_PLIN | CARD"
        decimal amount "aplicado a la cuenta"
        decimal receivedAmount "solo CASH"
        decimal changeAmount "solo CASH"
        string reference "nullable; YAPE_PLIN y CARD"
        uuid idempotencyKey UK
        uuid cashierId FK
        datetime paidAt
        enum status "VALID | VOIDED"
        string voidReason "nullable"
        uuid voidedById FK "nullable"
        datetime voidedAt "nullable"
    }

    BILL_SPLIT {
        uuid id PK
        uuid orderId FK
        enum mode "EQUAL | BY_ITEMS"
        decimal baseAmount "saldo pendiente al dividir"
        uuid createdById FK
        datetime createdAt
        datetime supersededAt "nullable; null = vigente"
    }

    BILL_PART {
        uuid id PK
        uuid splitId FK
        int position "1..n"
        string label "Parte 1, Parte 2, ..."
        decimal amount
    }

    BILL_PART_ITEM {
        uuid id PK
        uuid partId FK
        uuid orderItemId FK
        int units
    }

    DAY_CLOSURE {
        uuid id PK
        uuid cashierId FK
        datetime startedAt
        datetime closedAt
        decimal expectedCash
        decimal countedCash
        decimal expectedYapePlin
        decimal countedYapePlin
        decimal expectedCard
        decimal countedCard
        decimal total "suma de lo registrado"
        int accountsCount
        string notes "nullable; obligatoria si hay diferencias"
    }
```

## 2. Valores derivados (no se guardan)

| Valor | Cálculo | Fuente |
|-------|---------|--------|
| Total de la cuenta | `consumptionCents` de los ítems del pedido (enviados, no `VOIDED`, unidades vigentes × `unitPrice`) | 003 `order-mapper.ts` |
| Pagado | Σ `Payment.amount` con `status = VALID` del pedido | Caja |
| Saldo pendiente | Total − Pagado | Caja |
| Parte pagada | Σ pagos vigentes con ese `partId` ≥ `BillPart.amount` | Caja |
| División desactualizada (`isStale`) | `BillSplit.baseAmount` + pagos vigentes que no son de sus partes ≠ total actual (cambió el total, o se registró o anuló un pago fuera de la división) | Caja ([research.md §6](research.md)) |
| Unidades pagadas de un ítem (`paidUnits`) | Σ unidades de `BillPartItem` en partes pagadas (de cualquier división del pedido) | Caja |
| Diferencia del cierre por método | `counted − expected` (positivo = sobrante, negativo = faltante) | Caja |

## 3. Entidades nuevas

### Payment

| Campo | Reglas |
|-------|--------|
| `method` | `CASH` (Efectivo), `YAPE_PLIN` (Yape/Plin), `CARD` (Tarjeta). |
| `amount` | > 0 y ≤ saldo pendiente (FR-007). Si `partId` está presente, ≤ lo que falta de esa parte. |
| `receivedAmount`, `changeAmount` | Obligatorios solo en `CASH`: `receivedAmount ≥ amount` (FR-006), `changeAmount = receivedAmount − amount`. Nulos en otros métodos. |
| `reference` | Opcional, hasta 40 caracteres, solo en `YAPE_PLIN` y `CARD`. |
| `idempotencyKey` | UUID único enviado en la cabecera `Idempotency-Key`. |
| `status` | `VALID` al crear. Pasa a `VOIDED` con `voidReason` (3 a 200 caracteres), `voidedById` y `voidedAt`, solo mientras el pedido siga `OPEN` (FR-014). |
| `closureId` | Nulo hasta que un cierre lo incluye; después no cambia (FR-019). |

Restricciones en la migración: `CHECK (amount > 0)`; `CHECK ((method = 'CASH') = (received_amount IS NOT NULL))`;
`CHECK (received_amount IS NULL OR received_amount >= amount)`. Índices: `(order_id, status)`,
`(closure_id)`, `(paid_at)`.

### BillSplit, BillPart y BillPartItem

- Un pedido tiene a lo sumo una división vigente: índice único parcial
  `bill_splits_one_active_per_order ON (order_id) WHERE superseded_at IS NULL`.
- `EQUAL`: entre 2 y 20 partes; montos según [research.md §6](research.md); sin `BillPartItem`.
- `BY_ITEMS`: entre 2 y 20 partes; cada `BillPartItem.units ≥ 1`; por cada ítem, la suma de
  unidades asignadas en la división = unidades vigentes no pagadas del ítem; una parte sin
  ítems no es válida.
- `Σ BillPart.amount = BillSplit.baseAmount` (se verifica al crear).

### DayClosure

- `startedAt` = `closedAt` del cierre anterior, o `paidAt` del primer pago si no hay cierres.
- `expected*` = Σ pagos `VALID` del método con `closureId` nulo al confirmar.
- `counted*` ≥ 0, con 2 decimales.
- `notes` obligatoria (5 a 300 caracteres) si alguna diferencia ≠ 0 (FR-018).
- Inmutable una vez creado (FR-019).

## 4. Transiciones de estado que produce Caja

Caja solo ejecuta las transiciones que la 003 le asigna ([003 data-model](../003-mesas-pedidos/data-model.md)):

```mermaid
stateDiagram-v2
    state "Mesa POR_COBRAR / Pedido OPEN" as Pending
    state "Mesa LIBRE / Pedido PAID" as Paid
    [*] --> Pending: el mozo pide la cuenta (003)
    Pending --> Pending: pago parcial o anulación de pago (005)
    Pending --> Paid: el saldo llega a cero, o cierre sin cobro con total cero (005)
    Pending --> [*]: el mozo agrega algo, la mesa vuelve a OCUPADA (003)
    Paid --> [*]
```

```mermaid
stateDiagram-v2
    [*] --> Vigente: el cajero registra el pago
    Vigente --> Anulado: el cajero lo anula con motivo (solo con el pedido OPEN)
    Vigente --> Cerrado: el cierre del día lo incluye
    Anulado --> Cerrado: el cierre del día lo incluye (no suma)
```
