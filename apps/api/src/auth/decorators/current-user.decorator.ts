import { createParamDecorator, type ExecutionContext, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../../common/app.exception';
import type { SessionContext } from '../auth.types';

/** Devuelve el usuario y la sesión que SessionGuard adjuntó a la petición. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): SessionContext => {
  const request = context.switchToHttp().getRequest<Request>();
  if (!request.auth) throw new AppException('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
  return request.auth;
});
