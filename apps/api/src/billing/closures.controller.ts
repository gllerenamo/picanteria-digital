import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  closureCountsSchema,
  confirmClosureSchema,
  type ClosureCounts,
  type ClosureSummary,
  type ConfirmClosureRequest,
  type DayClosure,
} from '@picanteria/shared';
import type { SessionContext } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ClosuresService } from './closures.service';

/** specs/005-caja-reportes/contracts/rest-api.yaml (closures). El administrador siempre pasa. */
@Roles('CASHIER')
@Controller('billing/closures')
export class ClosuresController {
  constructor(private readonly closures: ClosuresService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(@Body(new ZodValidationPipe(closureCountsSchema)) body: ClosureCounts): Promise<ClosureSummary> {
    return this.closures.preview(body);
  }

  @Post()
  confirm(
    @Body(new ZodValidationPipe(confirmClosureSchema)) body: ConfirmClosureRequest,
    @CurrentUser() auth: SessionContext,
  ): Promise<DayClosure> {
    return this.closures.confirm(body, auth.user);
  }

  @Get()
  history(): Promise<DayClosure[]> {
    return this.closures.history();
  }
}
