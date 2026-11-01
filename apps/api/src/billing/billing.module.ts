import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { BillingNotifier } from './billing-notifier';
import { SplitsService } from './splits.service';

/** Caja y reportes (specs/005-caja-reportes). */
@Module({
  imports: [PrismaModule, MenuModule, RealtimeModule],
  controllers: [AccountsController],
  providers: [AccountsService, SplitsService, BillingNotifier],
})
export class BillingModule {}
