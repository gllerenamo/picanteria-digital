import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { TablesController } from './tables.controller';
import { TablesService } from './tables.service';

@Module({
  imports: [PrismaModule],
  controllers: [MenuController, TablesController],
  providers: [MenuService, TablesService],
  exports: [MenuService, TablesService],
})
export class MenuModule {}
