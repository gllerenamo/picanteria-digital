import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Injectable,
  Param,
  Patch,
  type PipeTransform,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  createCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  type CategoryResponse,
  type CategoryWithItemsResponse,
  type CreateCategoryRequest,
  type CreateMenuItemRequest,
  type MenuItemResponse,
  type UpdateMenuItemRequest,
} from '@picanteria/shared';
import { z } from 'zod';
import { Roles } from '../auth/decorators/roles.decorator';
import { AppException } from '../common/app.exception';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MenuService } from './menu.service';

const uuidSchema = z.string().uuid();

@Injectable()
class UuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!uuidSchema.safeParse(value).success) {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'El elemento no existe' });
    }
    return value;
  }
}

@Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get('categories')
  listCategories(): Promise<CategoryResponse[]> {
    return this.menu.listCategories();
  }

  @Get('tree')
  getTree(@Query('availableOnly') availableOnly?: string): Promise<CategoryWithItemsResponse[]> {
    return this.menu.getMenuHierarchical(availableOnly === 'true');
  }

  @Roles('ADMIN')
  @Post('categories')
  createCategory(
    @Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryRequest,
  ): Promise<CategoryResponse> {
    return this.menu.createCategory(body);
  }

  @Get('items')
  listItems(
    @Query('categoryId') categoryId?: string,
    @Query('availableOnly') availableOnly?: string,
  ): Promise<MenuItemResponse[]> {
    return this.menu.listItems({
      categoryId: categoryId || undefined,
      availableOnly: availableOnly === 'true',
    });
  }

  @Roles('ADMIN')
  @Post('items')
  createItem(
    @Body(new ZodValidationPipe(createMenuItemSchema)) body: CreateMenuItemRequest,
  ): Promise<MenuItemResponse> {
    return this.menu.createItem(body);
  }

  @Roles('ADMIN')
  @Put('items/:id')
  updateItem(
    @Param('id', UuidPipe) id: string,
    @Body(new ZodValidationPipe(updateMenuItemSchema)) body: UpdateMenuItemRequest,
  ): Promise<MenuItemResponse> {
    return this.menu.updateItem(id, body);
  }

  @Patch('items/:id/availability')
  toggleAvailability(
    @Param('id', UuidPipe) id: string,
    @Body() body: { isAvailable?: boolean },
  ): Promise<MenuItemResponse> {
    return this.menu.toggleAvailability(id, body.isAvailable);
  }

  @Roles('ADMIN')
  @Patch('items/:id/status')
  setStatus(
    @Param('id', UuidPipe) id: string,
    @Body() body: { isActive: boolean },
  ): Promise<MenuItemResponse> {
    return this.menu.setItemActive(id, body.isActive);
  }
}
