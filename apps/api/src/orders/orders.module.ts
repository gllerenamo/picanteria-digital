import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

/** Mesas, pedidos, envíos a cocina y anulaciones (specs/003-mesas-pedidos). */
@Module({
  imports: [PrismaModule, MenuModule, RealtimeModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
