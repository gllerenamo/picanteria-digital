import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import {
  addOrderItemSchema,
  openOrderSchema,
  updateOrderSchema,
  type AddOrderItemRequest,
  type OpenOrderRequest,
  type OrderDetail,
  type OrderItemResponse,
  type TableOverview,
  type UpdateOrderRequest,
} from '@picanteria/shared';
import type { SessionContext } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrderItemsService } from './order-items.service';
import { OrdersService } from './orders.service';
import { OrderIdPipe } from './params';

/** specs/003-mesas-pedidos/contracts/rest-api.yaml (Mesas y Pedido). */
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly items: OrderItemsService,
  ) {}

  // Ruta estática declarada antes que ':orderId' para que el pipe de UUID no la rechace.
  @Roles('WAITER', 'CASHIER')
  @Get('tables')
  listTables(): Promise<TableOverview[]> {
    return this.orders.listTables();
  }

  @Roles('WAITER')
  @Post()
  open(
    @Body(new ZodValidationPipe(openOrderSchema)) body: OpenOrderRequest,
    @CurrentUser() auth: SessionContext,
  ): Promise<OrderDetail> {
    return this.orders.open(body, auth.user);
  }

  @Roles('WAITER', 'CASHIER')
  @Get(':orderId')
  get(@Param('orderId', OrderIdPipe) orderId: string, @CurrentUser() auth: SessionContext): Promise<OrderDetail> {
    return this.orders.getDetail(orderId, auth.user);
  }

  @Roles('WAITER')
  @Patch(':orderId')
  update(
    @Param('orderId', OrderIdPipe) orderId: string,
    @Body(new ZodValidationPipe(updateOrderSchema)) body: UpdateOrderRequest,
    @CurrentUser() auth: SessionContext,
  ): Promise<OrderDetail> {
    return this.orders.updateGuestCount(orderId, body, auth.user);
  }

  @Roles('WAITER')
  @Post(':orderId/items')
  addItem(
    @Param('orderId', OrderIdPipe) orderId: string,
    @Body(new ZodValidationPipe(addOrderItemSchema)) body: AddOrderItemRequest,
  ): Promise<OrderItemResponse> {
    return this.items.add(orderId, body);
  }

  @Roles('WAITER')
  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(@Param('orderId', OrderIdPipe) orderId: string, @CurrentUser() auth: SessionContext): Promise<void> {
    return this.orders.cancel(orderId, auth.user);
  }
}
