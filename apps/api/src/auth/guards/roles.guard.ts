import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@picanteria/shared';
import type { Request } from 'express';
import { AppException } from '../../common/app.exception';
import { ROLES_KEY } from '../decorators/roles.decorator';

/** Compara el rol del usuario con @Roles(); ADMIN siempre pasa (FR-011). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const { auth } = context.switchToHttp().getRequest<Request>();
    if (!auth) return true; // Ruta pública: SessionGuard ya decidió.
    if (auth.user.role === 'ADMIN' || roles.includes(auth.user.role)) return true;
    throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
  }
}
