import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { KitchenBoardService } from './kitchen-board.service';
import { KitchenItemsService } from './kitchen-items.service';
import { KitchenController } from './kitchen.controller';
import { ReadyNoticesController } from './ready-notices.controller';
import { ReadyNoticesService } from './ready-notices.service';
import { VoidNoticesService } from './void-notices.service';

/** Pantalla de comandas, estados de los platos y avisos (specs/004-cocina). */
@Module({
  imports: [PrismaModule, RealtimeModule],
  controllers: [KitchenController, ReadyNoticesController],
  providers: [KitchenBoardService, KitchenItemsService, ReadyNoticesService, VoidNoticesService],
})
export class KitchenModule {}
