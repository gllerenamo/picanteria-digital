import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import { updateOrderItemSchema, type OrderItemResponse, type UpdateOrderItemRequest } from '@picanteria/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrderItemsService } from './order-items.service';
import { ItemIdPipe } from './params';

/** specs/003-mesas-pedidos/contracts/rest-api.yaml (/order-items). */
@Controller('order-items')
export class OrderItemsController {
  constructor(private readonly items: OrderItemsService) {}

  @Roles('WAITER')
  @Patch(':itemId')
  update(
    @Param('itemId', ItemIdPipe) itemId: string,
    @Body(new ZodValidationPipe(updateOrderItemSchema)) body: UpdateOrderItemRequest,
  ): Promise<OrderItemResponse> {
    return this.items.update(itemId, body);
  }

  @Roles('WAITER')
  @Delete(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('itemId', ItemIdPipe) itemId: string): Promise<void> {
    return this.items.remove(itemId);
  }
}
