import { type OnGatewayConnection, type OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import {
  REALTIME_EVENTS,
  ROLES,
  type ProfileChangedPayload,
  type Role,
  type ServerToClientEvents,
  type SessionRevokedPayload,
} from '@picanteria/shared';
import { parse } from 'cookie';
import type { Server, Socket } from 'socket.io';
import { SESSION_COOKIE, SessionsService } from '../auth/sessions.service';

interface SocketData {
  userId: string;
  sessionId: string;
  role: Role;
}

type RealtimeServer = Server<Record<string, never>, ServerToClientEvents, Record<string, never>, SocketData>;
type RealtimeSocket = Socket<Record<string, never>, ServerToClientEvents, Record<string, never>, SocketData>;

const userRoom = (userId: string): string => `user:${userId}`;
const sessionRoom = (sessionId: string): string => `session:${sessionId}`;
const roleRoom = (role: Role): string => `role:${role}`;

/** Canal Socket.IO autenticado con la cookie de sesión (contracts/websocket-events.md). */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  private server!: RealtimeServer;

  constructor(private readonly sessions: SessionsService) {}

  afterInit(server: RealtimeServer): void {
    // Sin sesión válida la conexión se rechaza con el error UNAUTHENTICATED.
    server.use((socket, next) => {
      const cookies = parse(socket.handshake.headers.cookie ?? '');
      this.sessions
        .validate(cookies[SESSION_COOKIE])
        .then((auth) => {
          if (!auth) {
            next(new Error('UNAUTHENTICATED'));
            return;
          }
          socket.data = { userId: auth.user.id, sessionId: auth.sessionId, role: auth.user.role };
          next();
        })
        .catch(() => {
          next(new Error('UNAUTHENTICATED'));
        });
    });
  }

  async handleConnection(socket: RealtimeSocket): Promise<void> {
    const { userId, sessionId, role } = socket.data;
    // El administrador se une a todas las salas de rol (FR-011).
    const roles = role === 'ADMIN' ? ROLES : [role];
    await socket.join([userRoom(userId), sessionRoom(sessionId), ...roles.map(roleRoom)]);
  }

  // disconnectSockets() sin cerrar la conexión de bajo nivel envía el aviso y luego la
  // desconexión, en ese orden; cerrarla de golpe puede perder el aviso detrás de un proxy.

  /** Avisa al usuario desactivado y cierra todas sus conexiones. */
  userDisabled(userId: string): void {
    const payload: SessionRevokedPayload = { reason: 'USER_DISABLED' };
    this.server.to(userRoom(userId)).emit(REALTIME_EVENTS.SESSION_REVOKED, payload);
    this.server.in(userRoom(userId)).disconnectSockets();
  }

  /** Avisa solo a las conexiones de la sesión que se cerró. */
  sessionClosed(sessionId: string): void {
    const payload: SessionRevokedPayload = { reason: 'LOGGED_OUT' };
    this.server.to(sessionRoom(sessionId)).emit(REALTIME_EVENTS.SESSION_REVOKED, payload);
    this.server.in(sessionRoom(sessionId)).disconnectSockets();
  }

  profileChanged(userId: string, payload: ProfileChangedPayload): void {
    this.server.to(userRoom(userId)).emit(REALTIME_EVENTS.PROFILE_CHANGED, payload);
  }
}
