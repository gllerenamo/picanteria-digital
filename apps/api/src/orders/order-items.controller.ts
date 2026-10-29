import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import {
  updateOrderItemSchema,
  voidOrderItemSchema,
  type OrderItemResponse,
  type UpdateOrderItemRequest,
  type VoidOrderItemRequest,
  type VoidResult,
} from '@picanteria/shared';
import type { SessionContext } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrderItemsService } from './order-items.service';
import { ItemIdPipe } from './params';
import { VoidsService } from './voids.service';

/** specs/003-mesas-pedidos/contracts/rest-api.yaml (/order-items). */
@Controller('order-items')
export class OrderItemsController {
  constructor(
    private readonly items: OrderItemsService,
    private readonly voids: VoidsService,
  ) {}

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

  /** Solo el administrador anula lo ya enviado (FR-028). */
  @Roles('ADMIN')
  @Post(':itemId/voids')
  void(
    @Param('itemId', ItemIdPipe) itemId: string,
    @Body(new ZodValidationPipe(voidOrderItemSchema)) body: VoidOrderItemRequest,
    @CurrentUser() auth: SessionContext,
  ): Promise<VoidResult> {
    return this.voids.void(itemId, body, auth.user);
  }
}
