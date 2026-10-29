# Data Model: Base común — inicio de sesión, roles y gestión de usuarios

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-28

Este documento tiene dos partes:

1. **Modelo general del sistema**: diagrama entidad-relación de todos los dominios (auth,
   menu, orders, kitchen, billing), para que las features posteriores partan de una visión
   común.
2. **Detalle de esta feature**: las entidades que esta feature implementa (`User`, `Session`)
   con campos, reglas de validación y transiciones de estado.

Los identificadores de código (tablas, campos, enums) están en inglés; las etiquetas visibles
para el usuario se traducen en la interfaz (Principio III).

## 1. Modelo general del sistema

> Solo `USER` y `SESSION` se definen aquí, con sus campos, porque son las únicas entidades que
> implementa esta feature. Las demás aparecen **sin campos ni estados**: el diagrama solo
> muestra que existen y cómo se relacionan. Sus campos, estados, cardinalidades exactas y
> entidades adicionales (por ejemplo, para el envío a cocina o la anulación parcial) los
> define el `data-model.md` de la feature dueña, que prevalece sobre este diagrama.

```mermaid
erDiagram
    USER ||--o{ SESSION : "inicia"
    USER ||--o{ ORDER : "atiende (mozo)"
    USER ||--o{ BILL : "cobra (cajero)"
    MENU_CATEGORY ||--o{ MENU_ITEM : "agrupa"
    DINING_TABLE ||--o{ ORDER : "recibe"
    ORDER ||--|{ ORDER_ITEM : "contiene"
    MENU_ITEM ||--o{ ORDER_ITEM : "se pide como"
    ORDER ||--o{ BILL : "se cobra con"
    BILL ||--|{ PAYMENT : "se paga con"

    USER {
        uuid id PK
        string fullName
        string username UK "minúsculas"
        string passwordHash
        enum role "ADMIN | WAITER | KITCHEN | CASHIER"
        boolean isActive
        int failedLoginAttempts
        datetime lockedUntil "nullable"
        datetime createdAt
        datetime updatedAt
    }

    SESSION {
        uuid id PK
        uuid userId FK
        string tokenHash UK "SHA-256 del token"
        datetime createdAt
        datetime expiresAt
        datetime revokedAt "nullable"
        string userAgent "nullable"
    }
```

### Correspondencia con módulos y features

| Entidad | Nombre en el dominio | Módulo backend | Feature dueña |
|---------|----------------------|----------------|---------------|
| `USER`, `SESSION` | Usuario, sesión | `auth` | `001-base-comun` (**esta feature**) |
| `MENU_CATEGORY`, `MENU_ITEM` | Categoría, plato de la carta | `menu` | `002` carta |
| `DINING_TABLE`, `ORDER`, `ORDER_ITEM` | Mesa, pedido, ítem del pedido | `orders` | `003-mesas-pedidos` |
| — (estados de preparación de los ítems) | Comanda en cocina | `kitchen` | `004-cocina` |
| `BILL`, `PAYMENT` | Cuenta, pago | `billing` | `005` caja |

**Lo que esta feature fija para las demás**: los usuarios nunca se eliminan, solo se
desactivan (FR-018). Toda referencia a un usuario desde otras entidades (el mozo de un pedido,
el administrador que autoriza una anulación, el cajero que cobra) apunta siempre a un usuario
existente, aunque esté inactivo.

## 2. Entidades de esta feature

### Role (enum)

| Valor | Etiqueta en la interfaz | Pantalla inicial |
|-------|-------------------------|------------------|
| `ADMIN` | Administrador | `/admin/usuarios` |
| `WAITER` | Mozo | `/mozo` |
| `KITCHEN` | Cocina | `/cocina` |
| `CASHIER` | Cajero | `/caja` |

Cada usuario tiene exactamente un rol (FR-009). `ADMIN` tiene acceso a todas las pantallas y
operaciones (FR-011). La matriz completa está en [contracts/ui-routes.md](contracts/ui-routes.md).

### User

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | UUID | Generado por el sistema. |
| `fullName` | texto | Obligatorio; 2 a 100 caracteres tras quitar espacios en los extremos. |
| `username` | texto, único | Obligatorio; se quitan espacios en los extremos y se guarda en minúsculas; 3 a 30 caracteres de `a-z`, `0-9`, `.`, `-`, `_`. Único (FR-014). |
| `passwordHash` | texto | Hash Argon2id. Nunca se devuelve en ninguna respuesta (FR-021). |
| `role` | `Role` | Obligatorio. |
| `isActive` | booleano | `true` al crear. |
| `failedLoginAttempts` | entero ≥ 0 | Se reinicia a 0 al ingresar con éxito o al vencer el bloqueo. |
| `lockedUntil` | fecha y hora, opcional | Se fija a ahora + 15 min al llegar a 5 fallos (FR-003). |
| `createdAt`, `updatedAt` | fecha y hora | Automáticos. |

**Reglas de validación de entrada** (esquemas Zod en `packages/shared`):

- Contraseña: 8 a 128 caracteres (FR-015).
- Al crear: `fullName`, `username`, `password`, `role` obligatorios.
- Al editar: solo `fullName` y `role` (FR-016). El nombre de usuario no se edita en esta
  versión.

**Invariantes**:

- Siempre existe al menos un usuario con `role = ADMIN` e `isActive = true` (FR-019, AC-3.8).
- Un administrador no puede desactivarse a sí mismo (FR-019).

**Estados del usuario**:

```mermaid
stateDiagram-v2
    [*] --> Activo: el administrador lo registra
    Activo --> Bloqueado: 5 intentos fallidos seguidos
    Bloqueado --> Activo: pasan 15 minutos
    Activo --> Inactivo: el administrador lo desactiva
    Bloqueado --> Inactivo: el administrador lo desactiva
    Inactivo --> Activo: el administrador lo reactiva
```

"Bloqueado" no es un valor guardado: se deriva de `lockedUntil > ahora`. Desactivar a un
usuario revoca todas sus sesiones vigentes (AC-3.6).

### Session

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | UUID | Generado por el sistema. |
| `userId` | UUID → User | Obligatorio. |
| `tokenHash` | texto, único | SHA-256 del token enviado en la cookie. El token en claro nunca se guarda. |
| `createdAt` | fecha y hora | Momento del ingreso. |
| `expiresAt` | fecha y hora | `createdAt + 12 h` (FR-007). |
| `revokedAt` | fecha y hora, opcional | Se fija al cerrar sesión o al desactivar al usuario. |
| `userAgent` | texto, opcional | Para que el administrador pueda identificar dispositivos en el futuro. |

**Una sesión es válida** si `revokedAt` es nulo, `expiresAt > ahora` y su usuario está
activo. El rol se lee del usuario en cada petición, no de la sesión, para que un cambio de rol
aplique en la siguiente acción (FR-012, AC-2.4).

**Estados de la sesión**:

```mermaid
stateDiagram-v2
    [*] --> Vigente: ingreso correcto
    Vigente --> Cerrada: el usuario cierra sesión
    Vigente --> Revocada: el administrador desactiva al usuario
    Vigente --> Expirada: pasan 12 horas
    Cerrada --> [*]
    Revocada --> [*]
    Expirada --> [*]
```

"Expirada" se deriva de `expiresAt <= ahora`. "Cerrada" y "Revocada" se guardan ambas en
`revokedAt`; la diferencia solo importa para el evento de tiempo real enviado al frontend.

**Índices**: `Session.tokenHash` (único, búsqueda por petición), `Session.userId` (revocar todas
las sesiones de un usuario).
