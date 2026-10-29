import { z } from 'zod';

export const createCategorySchema = z
  .object({
    name: z
      .string({ required_error: 'Ingresa el nombre de la categoría' })
      .trim()
      .min(2, 'El nombre de la categoría debe tener al menos 2 caracteres')
      .max(50, 'El nombre de la categoría no puede superar 50 caracteres'),
    sortOrder: z.number().int('El orden debe ser un número entero').default(0),
  })
  .strict();
export type CreateCategoryRequest = z.infer<typeof createCategorySchema>;

export const categoryResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sortOrder: z.number(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CategoryResponse = z.infer<typeof categoryResponseSchema>;

export const createMenuItemSchema = z
  .object({
    categoryId: z.string({ required_error: 'Selecciona una categoría' }).uuid('Categoría inválida'),
    name: z
      .string({ required_error: 'Ingresa el nombre del plato' })
      .trim()
      .min(2, 'El nombre del plato debe tener al menos 2 caracteres')
      .max(80, 'El nombre del plato no puede superar 80 caracteres'),
    description: z
      .string()
      .trim()
      .max(255, 'La descripción no puede superar 255 caracteres')
      .nullable()
      .optional(),
    price: z
      .number({ required_error: 'Ingresa el precio' })
      .positive('El precio debe ser un número mayor a cero')
      .refine(
        (val) => {
          const decimalPart = val.toString().split('.')[1];
          return !decimalPart || decimalPart.length <= 2;
        },
        { message: 'El precio debe tener como máximo 2 decimales' },
      ),
    isAvailable: z.boolean().default(true).optional(),
  })
  .strict();
export type CreateMenuItemRequest = z.infer<typeof createMenuItemSchema>;

export const updateMenuItemSchema = z
  .object({
    categoryId: z.string().uuid('Categoría inválida').optional(),
    name: z
      .string()
      .trim()
      .min(2, 'El nombre del plato debe tener al menos 2 caracteres')
      .max(80, 'El nombre del plato no puede superar 80 caracteres')
      .optional(),
    description: z.string().trim().max(255).nullable().optional(),
    price: z
      .number()
      .positive('El precio debe ser un número mayor a cero')
      .refine(
        (val) => {
          const decimalPart = val.toString().split('.')[1];
          return !decimalPart || decimalPart.length <= 2;
        },
        { message: 'El precio debe tener como máximo 2 decimales' },
      )
      .optional(),
    isAvailable: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdateMenuItemRequest = z.infer<typeof updateMenuItemSchema>;

export const menuItemResponseSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  categoryName: z.string().optional(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  priceFormatted: z.string(),
  isAvailable: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MenuItemResponse = z.infer<typeof menuItemResponseSchema>;

export const categoryWithItemsResponseSchema = categoryResponseSchema.extend({
  items: z.array(menuItemResponseSchema),
});
export type CategoryWithItemsResponse = z.infer<typeof categoryWithItemsResponseSchema>;

export const TABLE_STATUS = ['LIBRE', 'OCUPADA', 'POR_COBRAR'] as const;
export type TableStatus = (typeof TABLE_STATUS)[number];

export const diningTableResponseSchema = z.object({
  id: z.string().uuid(),
  tableNumber: z.number().int(),
  capacity: z.number().int(),
  status: z.enum(TABLE_STATUS),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DiningTableResponse = z.infer<typeof diningTableResponseSchema>;
