import { Controller, Get } from '@nestjs/common';
import type { DiningTableResponse } from '@picanteria/shared';
import { TablesService } from './tables.service';

@Controller('tables')
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Get()
  list(): Promise<DiningTableResponse[]> {
    return this.tables.list();
  }
}
