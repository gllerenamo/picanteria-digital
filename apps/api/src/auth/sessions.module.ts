import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';

/** Separado de AuthModule para que el gateway de tiempo real lo use sin dependencias circulares. */
@Module({
  providers: [SessionsService, PasswordService],
  exports: [SessionsService, PasswordService],
})
export class SessionsModule {}
