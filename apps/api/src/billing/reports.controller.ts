import { Controller, Get, Query } from '@nestjs/common';
import {
  dateRangeQuerySchema,
  topDishesQuerySchema,
  type DateRangeQuery,
  type SalesReport,
  type TopDish,
  type TopDishesQuery,
} from '@picanteria/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ReportsService } from './reports.service';

/** specs/005-caja-reportes/contracts/rest-api.yaml (reports): solo el administrador (FR-025). */
@Roles('ADMIN')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('sales')
  sales(@Query(new ZodValidationPipe(dateRangeQuerySchema)) query: DateRangeQuery): Promise<SalesReport> {
    return this.reports.sales(query);
  }

  @Get('top-dishes')
  topDishes(@Query(new ZodValidationPipe(topDishesQuerySchema)) query: TopDishesQuery): Promise<TopDish[]> {
    return this.reports.topDishes({ from: query.from, to: query.to }, query.sortBy);
  }
}
