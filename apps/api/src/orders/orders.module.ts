import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrderItemsController } from './order-items.controller';
import { OrderItemsService } from './order-items.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

/** Mesas, pedidos, envíos a cocina y anulaciones (specs/003-mesas-pedidos). */
@Module({
  imports: [PrismaModule, MenuModule, RealtimeModule],
  controllers: [OrdersController, OrderItemsController],
  providers: [OrdersService, OrderItemsService],
})
export class OrdersModule {}
