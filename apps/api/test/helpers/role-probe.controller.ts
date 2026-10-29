import { Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../../src/auth/decorators/roles.decorator';

/**
 * Controlador solo para pruebas: un endpoint de lectura y otro de escritura por rol, para
 * verificar la autorización sin depender de los endpoints de otras historias.
 */
@Controller('pruebas/roles')
export class RoleProbeController {
  static writes = 0;

  @Roles('WAITER')
  @Get('mozo')
  readWaiter(): { ok: true } {
    return { ok: true };
  }

  @Roles('WAITER')
  @Post('mozo')
  writeWaiter(): { ok: true } {
    return RoleProbeController.write();
  }

  @Roles('KITCHEN')
  @Get('cocina')
  readKitchen(): { ok: true } {
    return { ok: true };
  }

  @Roles('KITCHEN')
  @Post('cocina')
  writeKitchen(): { ok: true } {
    return RoleProbeController.write();
  }

  @Roles('CASHIER')
  @Get('caja')
  readCashier(): { ok: true } {
    return { ok: true };
  }

  @Roles('CASHIER')
  @Post('caja')
  writeCashier(): { ok: true } {
    return RoleProbeController.write();
  }

  @Roles('ADMIN')
  @Get('admin')
  readAdmin(): { ok: true } {
    return { ok: true };
  }

  @Roles('ADMIN')
  @Post('admin')
  writeAdmin(): { ok: true } {
    return RoleProbeController.write();
  }

  private static write(): { ok: true } {
    RoleProbeController.writes += 1;
    return { ok: true };
  }
}
