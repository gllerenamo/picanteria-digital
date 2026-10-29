import { Module } from '@nestjs/common';
import { SessionsModule } from '../auth/sessions.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [SessionsModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
