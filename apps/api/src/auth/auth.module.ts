import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CsrfGuard } from '../common/csrf.guard';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { SessionGuard } from './guards/session.guard';
import { SessionsModule } from './sessions.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SessionsModule, RealtimeModule],
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    UsersService,
    // Orden de ejecución: CSRF → sesión → rol.
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
