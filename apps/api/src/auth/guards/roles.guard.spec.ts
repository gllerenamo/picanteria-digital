import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES, type Role } from '@picanteria/shared';
import { AppException } from '../../common/app.exception';
import { RolesGuard } from './roles.guard';

function contextFor(role: Role | undefined, required: Role[] | undefined): { guard: RolesGuard; context: ExecutionContext } {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);
  const request = role ? { auth: { sessionId: 's1', user: { id: 'u1', fullName: 'X', username: 'x', role } } } : {};
  const context = {
    getType: () => 'http',
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard: new RolesGuard(reflector), context };
}

describe('RolesGuard', () => {
  it('deja pasar los endpoints sin @Roles', () => {
    const { guard, context } = contextFor('WAITER', undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  for (const required of ['WAITER', 'KITCHEN', 'CASHIER', 'ADMIN'] as const) {
    for (const role of ROLES) {
      const allowed = role === 'ADMIN' || role === required;
      it(`${role} ${allowed ? 'puede' : 'no puede'} usar un endpoint @Roles(${required})`, () => {
        const { guard, context } = contextFor(role, [required]);
        if (allowed) {
          expect(guard.canActivate(context)).toBe(true);
        } else {
          expect(() => guard.canActivate(context)).toThrow(AppException);
        }
      });
    }
  }

  it('responde FORBIDDEN con el mensaje en español', () => {
    const { guard, context } = contextFor('KITCHEN', ['CASHIER']);
    try {
      guard.canActivate(context);
      throw new Error('debía rechazar');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(403);
      expect((error as AppException).body).toEqual({
        code: 'FORBIDDEN',
        message: 'No tienes permiso para realizar esta acción',
      });
    }
  });
});
