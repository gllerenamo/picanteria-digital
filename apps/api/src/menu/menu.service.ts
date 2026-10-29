import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CategoryResponse,
  CategoryWithItemsResponse,
  CreateCategoryRequest,
  CreateMenuItemRequest,
  MenuItemResponse,
  UpdateMenuItemRequest,
} from '@picanteria/shared';
import { AppException } from '../common/app.exception';
import { PrismaService } from '../prisma/prisma.service';

function formatSoles(amount: number): string {
  return `S/ ${amount.toFixed(2)}`;
}

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(): Promise<CategoryResponse[]> {
    const categories = await this.prisma.menuCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
      createdAt: cat.createdAt.toISOString(),
      updatedAt: cat.updatedAt.toISOString(),
    }));
  }

  async getMenuHierarchical(availableOnly = false): Promise<CategoryWithItemsResponse[]> {
    const categories = await this.prisma.menuCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: {
            isActive: true,
            ...(availableOnly ? { isAvailable: true } : {}),
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
      createdAt: cat.createdAt.toISOString(),
      updatedAt: cat.updatedAt.toISOString(),
      items: cat.items.map((item) => {
        const priceNum = Number(item.price);
        return {
          id: item.id,
          categoryId: item.categoryId,
          categoryName: cat.name,
          name: item.name,
          description: item.description,
          price: priceNum,
          priceFormatted: formatSoles(priceNum),
          isAvailable: item.isAvailable,
          isActive: item.isActive,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        };
      }),
    }));
  }

  async createCategory(data: CreateCategoryRequest): Promise<CategoryResponse> {
    const existing = await this.prisma.menuCategory.findFirst({
      where: {
        name: { equals: data.name.trim(), mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new AppException('CATEGORY_NAME_TAKEN', HttpStatus.CONFLICT, {
        message: 'Ya existe una categoría con ese nombre',
      });
    }

    const created = await this.prisma.menuCategory.create({
      data: {
        name: data.name.trim(),
        sortOrder: data.sortOrder,
      },
    });

    return {
      id: created.id,
      name: created.name,
      sortOrder: created.sortOrder,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async listItems(query?: { categoryId?: string; availableOnly?: boolean }): Promise<MenuItemResponse[]> {
    const items = await this.prisma.menuItem.findMany({
      where: {
        isActive: true,
        ...(query?.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query?.availableOnly ? { isAvailable: true } : {}),
      },
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });

    return items.map((item) => {
      const priceNum = Number(item.price);
      return {
        id: item.id,
        categoryId: item.categoryId,
        categoryName: item.category.name,
        name: item.name,
        description: item.description,
        price: priceNum,
        priceFormatted: formatSoles(priceNum),
        isAvailable: item.isAvailable,
        isActive: item.isActive,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      };
    });
  }

  async createItem(data: CreateMenuItemRequest): Promise<MenuItemResponse> {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id: data.categoryId },
    });
    if (!category || !category.isActive) {
      throw new AppException('CATEGORY_NOT_FOUND', HttpStatus.BAD_REQUEST, {
        message: 'La categoría especificada no existe o no está activa',
      });
    }

    const existing = await this.prisma.menuItem.findFirst({
      where: {
        categoryId: data.categoryId,
        name: { equals: data.name.trim(), mode: 'insensitive' },
        isActive: true,
      },
    });
    if (existing) {
      throw new AppException('ITEM_NAME_TAKEN', HttpStatus.CONFLICT, {
        message: 'Ya existe un plato con ese nombre en esta categoría',
      });
    }

    const created = await this.prisma.menuItem.create({
      data: {
        categoryId: data.categoryId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        price: data.price,
        isAvailable: data.isAvailable ?? true,
      },
      include: { category: true },
    });

    const priceNum = Number(created.price);
    return {
      id: created.id,
      categoryId: created.categoryId,
      categoryName: created.category.name,
      name: created.name,
      description: created.description,
      price: priceNum,
      priceFormatted: formatSoles(priceNum),
      isAvailable: created.isAvailable,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateItem(id: string, data: UpdateMenuItemRequest): Promise<MenuItemResponse> {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!item) {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, {
        message: 'El plato solicitado no existe',
      });
    }

    const targetCategoryId = data.categoryId ?? item.categoryId;
    if (data.categoryId && data.categoryId !== item.categoryId) {
      const cat = await this.prisma.menuCategory.findUnique({ where: { id: data.categoryId } });
      if (!cat || !cat.isActive) {
        throw new AppException('CATEGORY_NOT_FOUND', HttpStatus.BAD_REQUEST, {
          message: 'La nueva categoría no existe o no está activa',
        });
      }
    }

    if (data.name && data.name.trim().toLowerCase() !== item.name.toLowerCase()) {
      const duplicate = await this.prisma.menuItem.findFirst({
        where: {
          id: { not: id },
          categoryId: targetCategoryId,
          name: { equals: data.name.trim(), mode: 'insensitive' },
          isActive: true,
        },
      });
      if (duplicate) {
        throw new AppException('ITEM_NAME_TAKEN', HttpStatus.CONFLICT, {
          message: 'Ya existe un plato con ese nombre en esta categoría',
        });
      }
    }

    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: {
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.isAvailable !== undefined ? { isAvailable: data.isAvailable } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: { category: true },
    });

    const priceNum = Number(updated.price);
    return {
      id: updated.id,
      categoryId: updated.categoryId,
      categoryName: updated.category.name,
      name: updated.name,
      description: updated.description,
      price: priceNum,
      priceFormatted: formatSoles(priceNum),
      isAvailable: updated.isAvailable,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async toggleAvailability(id: string, targetAvailable?: boolean): Promise<MenuItemResponse> {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!item) {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, {
        message: 'El plato solicitado no existe',
      });
    }

    const newAvailable = targetAvailable !== undefined ? targetAvailable : !item.isAvailable;
    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: { isAvailable: newAvailable },
      include: { category: true },
    });

    const priceNum = Number(updated.price);
    return {
      id: updated.id,
      categoryId: updated.categoryId,
      categoryName: updated.category.name,
      name: updated.name,
      description: updated.description,
      price: priceNum,
      priceFormatted: formatSoles(priceNum),
      isAvailable: updated.isAvailable,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async setItemActive(id: string, isActive: boolean): Promise<MenuItemResponse> {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!item) {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, {
        message: 'El plato solicitado no existe',
      });
    }

    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: { isActive },
      include: { category: true },
    });

    const priceNum = Number(updated.price);
    return {
      id: updated.id,
      categoryId: updated.categoryId,
      categoryName: updated.category.name,
      name: updated.name,
      description: updated.description,
      price: priceNum,
      priceFormatted: formatSoles(priceNum),
      isAvailable: updated.isAvailable,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
