import { SetMetadata } from '@nestjs/common';
import type { Role } from '@picanteria/shared';

export const ROLES_KEY = 'roles';

/** Roles que pueden usar el endpoint; ADMIN siempre puede (FR-011). */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);
