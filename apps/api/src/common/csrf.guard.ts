import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from './app.exception';

export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'picanteria-web';
const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Segunda barrera CSRF además de la cookie SameSite=Strict (research.md §5). */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (MUTATING_METHODS.has(request.method) && request.get(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
      throw new AppException('CSRF_HEADER_MISSING', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
