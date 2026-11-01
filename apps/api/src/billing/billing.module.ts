import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';

/** Caja y reportes (specs/005-caja-reportes). */
@Module({
  imports: [PrismaModule, MenuModule, RealtimeModule],
})
export class BillingModule {}
