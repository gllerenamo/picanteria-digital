import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  createPaymentSchema,
  createSplitSchema,
  voidPaymentSchema,
  type AccountDetail,
  type AccountSummary,
  type CreatePaymentRequest,
  type CreateSplitRequest,
  type VoidPaymentRequest,
} from '@picanteria/shared';
import type { SessionContext } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { IdempotencyKey } from '../orders/idempotency-key.decorator';
import { OrderIdPipe } from '../orders/params';
import { AccountsService } from './accounts.service';
import { PaymentIdPipe } from './params';
import { SplitsService } from './splits.service';

/** specs/005-caja-reportes/contracts/rest-api.yaml (accounts). El administrador siempre pasa. */
@Roles('CASHIER')
@Controller('billing/accounts')
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly splits: SplitsService,
  ) {}

  @Get()
  list(): Promise<AccountSummary[]> {
    return this.accounts.listPending();
  }

  @Get(':orderId')
  get(@Param('orderId', OrderIdPipe) orderId: string): Promise<AccountDetail> {
    return this.accounts.getAccount(orderId);
  }

  @Post(':orderId/payments')
  pay(
    @Param('orderId', OrderIdPipe) orderId: string,
    @Body(new ZodValidationPipe(createPaymentSchema)) body: CreatePaymentRequest,
    @IdempotencyKey() idempotencyKey: string,
    @CurrentUser() auth: SessionContext,
  ): Promise<AccountDetail> {
    return this.accounts.createPayment(orderId, body, idempotencyKey, auth.user);
  }

  @Post(':orderId/payments/:paymentId/void')
  @HttpCode(HttpStatus.OK)
  voidPayment(
    @Param('orderId', OrderIdPipe) orderId: string,
    @Param('paymentId', PaymentIdPipe) paymentId: string,
    @Body(new ZodValidationPipe(voidPaymentSchema)) body: VoidPaymentRequest,
    @CurrentUser() auth: SessionContext,
  ): Promise<AccountDetail> {
    return this.accounts.voidPayment(orderId, paymentId, body.reason, auth.user);
  }

  @Post(':orderId/split')
  @HttpCode(HttpStatus.OK)
  split(
    @Param('orderId', OrderIdPipe) orderId: string,
    @Body(new ZodValidationPipe(createSplitSchema)) body: CreateSplitRequest,
    @CurrentUser() auth: SessionContext,
  ): Promise<AccountDetail> {
    return this.splits.createSplit(orderId, body, auth.user);
  }

  @Post(':orderId/close-without-charge')
  @HttpCode(HttpStatus.OK)
  closeWithoutCharge(@Param('orderId', OrderIdPipe) orderId: string): Promise<AccountDetail> {
    return this.accounts.closeWithoutCharge(orderId);
  }
}
