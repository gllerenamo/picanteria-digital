import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { DispatchesController } from './dispatches.controller';
import { DispatchesService } from './dispatches.service';
import { OrderItemsController } from './order-items.controller';
import { OrderItemsService } from './order-items.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { VoidsService } from './voids.service';

/** Mesas, pedidos, envíos a cocina y anulaciones (specs/003-mesas-pedidos). */
@Module({
  imports: [PrismaModule, MenuModule, RealtimeModule],
  controllers: [OrdersController, OrderItemsController, DispatchesController],
  providers: [OrdersService, OrderItemsService, DispatchesService, VoidsService],
})
export class OrdersModule {}
