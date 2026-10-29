import { createParamDecorator, type ExecutionContext, HttpStatus } from '@nestjs/common';
import { IDEMPOTENCY_KEY_HEADER, idempotencyKeySchema } from '@picanteria/shared';
import type { Request } from 'express';
import { AppException } from '../common/app.exception';

/** Lee y valida la cabecera `Idempotency-Key` del envío a cocina (FR-022, research.md §5). */
export const IdempotencyKey = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<Request>();
  const result = idempotencyKeySchema.safeParse(request.get(IDEMPOTENCY_KEY_HEADER));
  if (!result.success) {
    throw new AppException('VALIDATION_ERROR', HttpStatus.BAD_REQUEST, {
      details: { [IDEMPOTENCY_KEY_HEADER]: result.error.issues[0]?.message ?? 'Falta la clave de envío' },
    });
  }
  return result.data;
});
