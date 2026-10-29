import { Controller, Param, Post } from '@nestjs/common';
import type { DispatchResponse } from '@picanteria/shared';
import type { SessionContext } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DispatchesService } from './dispatches.service';
import { IdempotencyKey } from './idempotency-key.decorator';
import { OrderIdPipe } from './params';

/** POST /api/orders/{orderId}/dispatches (contracts/rest-api.yaml, Envío a cocina). */
@Controller('orders')
export class DispatchesController {
  constructor(private readonly dispatches: DispatchesService) {}

  @Roles('WAITER')
  @Post(':orderId/dispatches')
  send(
    @Param('orderId', OrderIdPipe) orderId: string,
    @IdempotencyKey() idempotencyKey: string,
    @CurrentUser() auth: SessionContext,
  ): Promise<DispatchResponse> {
    return this.dispatches.send(orderId, idempotencyKey, auth.user);
  }
}
