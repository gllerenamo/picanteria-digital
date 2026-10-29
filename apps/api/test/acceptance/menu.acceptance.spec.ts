import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
  CategoryResponse,
  CategoryWithItemsResponse,
  DiningTableResponse,
  MenuItemResponse,
} from '@picanteria/shared';
import type { User } from '@prisma/client';
import type TestAgent from 'supertest/lib/agent';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, prismaOf } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { createUser, loginAs } from '../helpers/factories';

describe('Feature 002: Módulo Carta, Disponibilidad y Catálogo de Mesas', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: User & { password: string };
  let waiter: User & { password: string };
  let adminAgent: TestAgent;
  let waiterAgent: TestAgent;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = prismaOf(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    admin = await createUser(prisma, { role: 'ADMIN', username: 'admin', fullName: 'Administrador' });
    waiter = await createUser(prisma, { role: 'WAITER', username: 'mozo1', fullName: 'Mozo Uno' });
    adminAgent = await loginAs(app, admin);
    waiterAgent = await loginAs(app, waiter);
  });

  describe('US1: Administrar platos y bebidas de la carta', () => {
    it('[002] AC-1.1: el administrador registra un nuevo plato con nombre, categoría, precio y descripción', async () => {
      const cat = await prisma.menuCategory.create({ data: { name: 'Fondos', sortOrder: 1 } });

      const response = await adminAgent
        .post('/api/menu/items')
        .send({
          categoryId: cat.id,
          name: 'Chupe de Camarones',
          price: 45.0,
          description: 'Chupe tradicional arequipeño con camarones de río y queso fresco',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        categoryId: cat.id,
        name: 'Chupe de Camarones',
        price: 45,
        priceFormatted: 'S/ 45.00',
        description: 'Chupe tradicional arequipeño con camarones de río y queso fresco',
        isAvailable: true,
        isActive: true,
      });
    });

    it('[002] AC-1.2: se rechaza la creación de un plato con precio negativo, cero o nombre vacío', async () => {
      const cat = await prisma.menuCategory.create({ data: { name: 'Entradas', sortOrder: 1 } });

      // Precio negativo
      await adminAgent
        .post('/api/menu/items')
        .send({ categoryId: cat.id, name: 'Rocoto Relleno', price: -10 })
        .expect(400);

      // Nombre vacío
      await adminAgent
        .post('/api/menu/items')
        .send({ categoryId: cat.id, name: '', price: 25 })
        .expect(400);
    });

    it('[002] AC-1.3: no se permite registrar un plato con nombre duplicado en la misma categoría', async () => {
      const cat = await prisma.menuCategory.create({ data: { name: 'Entradas', sortOrder: 1 } });
      await prisma.menuItem.create({
        data: { categoryId: cat.id, name: 'Ocopa Arequipeña', price: 18.0 },
      });

      const response = await adminAgent
        .post('/api/menu/items')
        .send({ categoryId: cat.id, name: 'ocopa arequipeña', price: 20.0 })
        .expect(409);

      expect(response.body).toMatchObject({
        code: 'ITEM_NAME_TAKEN',
      });
    });

    it('[002] AC-1.4: el administrador edita un plato existente y los cambios se guardan', async () => {
      const cat = await prisma.menuCategory.create({ data: { name: 'Fondos', sortOrder: 1 } });
      const item = await prisma.menuItem.create({
        data: { categoryId: cat.id, name: 'Adobo Tradicional', price: 30.0 },
      });

      const response = await adminAgent
        .put(`/api/menu/items/${item.id}`)
        .send({
          name: 'Adobo Arequipeño de Domingo',
          price: 35.5,
          description: 'Con chancho tierno y chicha de jora',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: item.id,
        name: 'Adobo Arequipeño de Domingo',
        price: 35.5,
        priceFormatted: 'S/ 35.50',
        description: 'Con chancho tierno y chicha de jora',
      });
    });

    it('[002] AC-1.5: el administrador desactiva un plato y deja de figurar en la carta activa', async () => {
      const cat = await prisma.menuCategory.create({ data: { name: 'Bebidas', sortOrder: 1 } });
      const item = await prisma.menuItem.create({
        data: { categoryId: cat.id, name: 'Cerveza Especial', price: 12.0 },
      });

      await adminAgent
        .patch(`/api/menu/items/${item.id}/status`)
        .send({ isActive: false })
        .expect(200);

      const itemsResponse = await waiterAgent.get('/api/menu/items').expect(200);
      const items = itemsResponse.body as MenuItemResponse[];
      expect(items.some((i) => i.id === item.id)).toBe(false);
    });

    it('[002] AC-1.6: un usuario con rol mozo no puede crear ni modificar platos (403 Forbidden)', async () => {
      const cat = await prisma.menuCategory.create({ data: { name: 'Entradas', sortOrder: 1 } });

      await waiterAgent
        .post('/api/menu/items')
        .send({ categoryId: cat.id, name: 'Solterito', price: 15.0 })
        .expect(403);
    });
  });

  describe('US2: Control de disponibilidad del día ("Se acabó el chupe")', () => {
    it('[002] AC-2.1: se conmuta la disponibilidad de un plato a no disponible de inmediato', async () => {
      const cat = await prisma.menuCategory.create({ data: { name: 'Fondos', sortOrder: 1 } });
      const item = await prisma.menuItem.create({
        data: { categoryId: cat.id, name: 'Chupe de Camarones', price: 45.0, isAvailable: true },
      });

      const response = await adminAgent
        .patch(`/api/menu/items/${item.id}/availability`)
        .send({ isAvailable: false })
        .expect(200);

      expect(response.body).toMatchObject({ isAvailable: false });
    });

    it('[002] AC-2.2: al filtrar platos disponibles, el plato agotado no se incluye', async () => {
      const cat = await prisma.menuCategory.create({ data: { name: 'Fondos', sortOrder: 1 } });
      await prisma.menuItem.create({
        data: { categoryId: cat.id, name: 'Rocoto Relleno', price: 28.0, isAvailable: true },
      });
      await prisma.menuItem.create({
        data: { categoryId: cat.id, name: 'Chupe Agotado', price: 45.0, isAvailable: false },
      });

      const response = await waiterAgent
        .get('/api/menu/items?availableOnly=true')
        .expect(200);

      const items = response.body as MenuItemResponse[];
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('Rocoto Relleno');
    });

    it('[002] AC-2.3: se reactiva la disponibilidad de un plato y vuelve a estar habilitado', async () => {
      const cat = await prisma.menuCategory.create({ data: { name: 'Bebidas', sortOrder: 1 } });
      const item = await prisma.menuItem.create({
        data: { categoryId: cat.id, name: 'Chicha de Guiñapo', price: 8.0, isAvailable: false },
      });

      const response = await adminAgent
        .patch(`/api/menu/items/${item.id}/availability`)
        .send({ isAvailable: true })
        .expect(200);

      expect(response.body).toMatchObject({ isAvailable: true });
    });

    it('[002] AC-2.4: marcar no disponible a mediodía no altera el registro ni el precio de ítems en el catálogo', async () => {
      const cat = await prisma.menuCategory.create({ data: { name: 'Fondos', sortOrder: 1 } });
      const item = await prisma.menuItem.create({
        data: { categoryId: cat.id, name: 'Pastel de Papa', price: 20.0, isAvailable: true },
      });

      await adminAgent
        .patch(`/api/menu/items/${item.id}/availability`)
        .send({ isAvailable: false })
        .expect(200);

      const dbItem = await prisma.menuItem.findUnique({ where: { id: item.id } });
      expect(Number(dbItem?.price)).toBe(20.0);
      expect(dbItem?.isAvailable).toBe(false);
    });
  });

  describe('US3: Categorización de la carta', () => {
    it('[002] AC-3.1: las categorías se retornan ordenadas según sortOrder ascendente', async () => {
      await prisma.menuCategory.create({ data: { name: 'Bebidas', sortOrder: 3 } });
      await prisma.menuCategory.create({ data: { name: 'Entradas', sortOrder: 1 } });
      await prisma.menuCategory.create({ data: { name: 'Fondos', sortOrder: 2 } });

      const response = await waiterAgent.get('/api/menu/categories').expect(200);
      const categories = response.body as CategoryResponse[];
      expect(categories.map((c) => c.name)).toEqual(['Entradas', 'Fondos', 'Bebidas']);
    });

    it('[002] AC-3.2: el administrador crea una nueva categoría indicando su nombre y orden', async () => {
      const response = await adminAgent
        .post('/api/menu/categories')
        .send({ name: 'Postres y Extras', sortOrder: 4 })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Postres y Extras',
        sortOrder: 4,
        isActive: true,
      });
    });

    it('[002] AC-3.3: no se permite registrar una categoría con nombre duplicado o vacío', async () => {
      await prisma.menuCategory.create({ data: { name: 'Entradas', sortOrder: 1 } });

      await adminAgent
        .post('/api/menu/categories')
        .send({ name: 'entradas', sortOrder: 2 })
        .expect(409);

      await adminAgent
        .post('/api/menu/categories')
        .send({ name: '', sortOrder: 1 })
        .expect(400);
    });

    it('[002] AC-3.4: la consulta jerárquica de la carta agrupa cada categoría con sus platos activos', async () => {
      const catEntradas = await prisma.menuCategory.create({ data: { name: 'Entradas', sortOrder: 1 } });
      const catFondos = await prisma.menuCategory.create({ data: { name: 'Fondos', sortOrder: 2 } });

      await prisma.menuItem.create({
        data: { categoryId: catEntradas.id, name: 'Solterito de Queso', price: 16.0 },
      });
      await prisma.menuItem.create({
        data: { categoryId: catFondos.id, name: 'Costillar Frito', price: 38.0 },
      });

      const response = await waiterAgent.get('/api/menu/tree').expect(200);
      const tree = response.body as CategoryWithItemsResponse[];
      expect(tree).toHaveLength(2);
      expect(tree[0]?.name).toBe('Entradas');
      expect(tree[0]?.items[0]?.name).toBe('Solterito de Queso');
      expect(tree[1]?.name).toBe('Fondos');
      expect(tree[1]?.items[0]?.name).toBe('Costillar Frito');
    });
  });

  describe('US4: Visualización en tablet y catálogo inicial de mesas', () => {
    it('[002] AC-4.1: los precios se retornan con formato en soles (S/ 00.00) y son accesibles por mozos', async () => {
      const cat = await prisma.menuCategory.create({ data: { name: 'Postres', sortOrder: 1 } });
      await prisma.menuItem.create({
        data: { categoryId: cat.id, name: 'Queso Helado', price: 10.5 },
      });

      const response = await waiterAgent.get('/api/menu/items').expect(200);
      const items = response.body as MenuItemResponse[];
      expect(items[0]?.priceFormatted).toBe('S/ 10.50');
      expect(items[0]?.price).toBe(10.5);
    });

    it('[002] AC-4.2: se pueden filtrar platos por categoría específica', async () => {
      const cat1 = await prisma.menuCategory.create({ data: { name: 'Entradas', sortOrder: 1 } });
      const cat2 = await prisma.menuCategory.create({ data: { name: 'Bebidas', sortOrder: 2 } });

      await prisma.menuItem.create({ data: { categoryId: cat1.id, name: 'E1', price: 10 } });
      await prisma.menuItem.create({ data: { categoryId: cat2.id, name: 'B1', price: 5 } });

      const response = await waiterAgent.get(`/api/menu/items?categoryId=${cat1.id}`).expect(200);
      const items = response.body as MenuItemResponse[];
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('E1');
    });

    it('[002] AC-4.3: el catálogo de mesas expone las mesas configuradas en el local', async () => {
      await prisma.diningTable.createMany({
        data: [
          { tableNumber: 1, capacity: 4, status: 'LIBRE' },
          { tableNumber: 2, capacity: 6, status: 'LIBRE' },
        ],
      });

      const response = await waiterAgent.get('/api/tables').expect(200);
      const tables = response.body as DiningTableResponse[];
      expect(tables).toHaveLength(2);
      expect(tables[0]).toMatchObject({ tableNumber: 1, capacity: 4, status: 'LIBRE' });
      expect(tables[1]).toMatchObject({ tableNumber: 2, capacity: 6, status: 'LIBRE' });
    });
  });
});
