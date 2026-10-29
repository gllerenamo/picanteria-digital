# Contrato de tiempo real (Socket.IO)

**Feature**: 001-base-comun | **Módulo backend**: `realtime` (infraestructura compartida)

## Conexión

- **Ruta**: `/socket.io` en el mismo origen que el frontend (nginx o el proxy de Vite la
  redirigen al backend).
- **Autenticación**: en el handshake, el servidor lee la cookie `sid` y la valida igual que en
  HTTP ([research.md §11](../research.md)). Sin sesión válida, la conexión se rechaza con el
  error `UNAUTHENTICATED` y el cliente no reintenta hasta que el usuario vuelva a iniciar
  sesión.
- **Salas**: al conectarse, el servidor une el socket a:
  - `user:<userId>`: eventos dirigidos a un usuario concreto.
  - `role:<ROLE>`: eventos para todos los usuarios de un rol (los usarán pedidos y cocina).
- **Ciclo de vida en el cliente**: el frontend abre el socket tras un ingreso correcto (o al
  cargar con sesión válida) y lo cierra al cerrar sesión.

## Eventos servidor → cliente (esta feature)

Los nombres de los eventos y los tipos de sus cargas están en `packages/shared/src/events.ts`.

### `auth:session-revoked`

Se emite a la sala `user:<userId>` cuando el administrador desactiva al usuario. También se
emite a los demás sockets del mismo usuario cuando cierra sesión en un dispositivo, **solo**
para la sesión cerrada.

```ts
type SessionRevokedPayload = {
  reason: 'USER_DISABLED' | 'LOGGED_OUT';
};
```

**Comportamiento esperado del cliente**: borrar el estado local, cerrar el socket e ir a
`/ingresar`. Si `reason` es `USER_DISABLED`, mostrar "Tu cuenta fue desactivada. Consulta al
administrador."

### `auth:profile-changed`

Se emite a la sala `user:<userId>` cuando el administrador cambia el nombre completo o el rol
del usuario.

```ts
type ProfileChangedPayload = {
  fields: Array<'fullName' | 'role'>;
};
```

**Comportamiento esperado del cliente**: volver a pedir `GET /api/auth/me`, redibujar el menú
y, si la pantalla actual ya no está permitida para el nuevo rol, ir a la nueva pantalla
inicial.

## Garantías

- Los eventos son una **mejora de experiencia**, no la garantía de seguridad: aunque el evento
  no llegue (sin conexión), la siguiente petición HTTP aplica el nuevo estado o rol porque el
  backend lo comprueba en cada petición (FR-012).
- Desactivar a un usuario desconecta del servidor todos sus sockets después de emitir
  `auth:session-revoked`.

## Eventos previstos para features posteriores (no se implementan aquí)

| Evento | Sala | Feature |
|--------|------|---------|
| `orders:created`, `orders:updated` | `role:KITCHEN`, `role:WAITER` | Pedidos |
| `kitchen:item-status-changed` | `role:WAITER`, `user:<mozo>` | Cocina |
| `billing:bill-paid` | `role:CASHIER`, `role:WAITER` | Caja |

`ADMIN` se une también a todas las salas de rol, coherente con FR-011.
