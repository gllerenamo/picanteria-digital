/**
 * Crea el administrador inicial si no existe, la carta tradicional arequipeña y las mesas del local.
 * Responsable de datos de ejemplo: Paolo Ramirez Melendres.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const CATEGORIES_DATA = [
  {
    name: 'Entradas',
    sortOrder: 1,
    items: [
      {
        name: 'Rocoto Relleno',
        description: 'Rocoto arequipeño horneado con relleno de carne picada y gratinado con queso, acompañado de pastel de papa',
        price: 28.0,
      },
      {
        name: 'Ocopa Arequipeña',
        description: 'Papas nativas bañadas en salsa tradicional de huacatay, ají mirasol, maní y queso fresco',
        price: 18.0,
      },
      {
        name: 'Solterito de Queso',
        description: 'Ensalada fresca de habas tiernas, choclo desgranado, cebolla, tomate, aceituna negra y queso paria',
        price: 16.0,
      },
      {
        name: 'Pastel de Papa',
        description: 'Capas de papa intercaladas con abundante queso fresco paria, leche y anís en grano',
        price: 14.0,
      },
    ],
  },
  {
    name: 'Segundos y Fondos',
    sortOrder: 2,
    items: [
      {
        name: 'Chupe de Camarones',
        description: 'Emblemático chupe arequipeño con camarones de río, papa amarilla, arroz, choclo, habas, huevo escalfado y huacatay',
        price: 45.0,
      },
      {
        name: 'Adobo Arequipeño',
        description: 'Lomo de chancho macerado en concho de chicha de guiñapo con ají panca y cebollas, servido con pan de tres puntas',
        price: 32.0,
      },
      {
        name: 'Costillar Frito',
        description: 'Costilla de cordero marinada y frita al punto crocante con papas doradas y zarza criolla',
        price: 38.0,
      },
      {
        name: 'Malaya Frita',
        description: 'Falda de res tierna sancochada y dorada, servida con papas doradas y zarza de cebolla',
        price: 36.0,
      },
      {
        name: 'Cuy Chactado',
        description: 'Cuy prensado a la piedra y frito crocante con papas doradas y ensalada criolla',
        price: 48.0,
      },
    ],
  },
  {
    name: 'Bebidas Típicas',
    sortOrder: 3,
    items: [
      {
        name: 'Chicha de Guiñapo (Jarra 1L)',
        description: 'Bebida fermentada tradicional de maíz negro arequipeño',
        price: 12.0,
      },
      {
        name: 'Chicha de Guiñapo (Vaso)',
        description: 'Vaso tradicional de chicha de guiñapo recién servida',
        price: 4.0,
      },
      {
        name: 'Kola Escocesa (500ml)',
        description: 'Gaseosa tradicional de Arequipa con agua mineral de Yura',
        price: 6.0,
      },
      {
        name: 'Anís Nájar (Copita)',
        description: 'Licor digestivo tradicional arequipeño de anís',
        price: 8.0,
      },
    ],
  },
  {
    name: 'Postres y Extras',
    sortOrder: 4,
    items: [
      {
        name: 'Queso Helado Arequipeño',
        description: 'Postre artesanal a base de leche fresca, canela, clavo de olor y coco rallado',
        price: 10.0,
      },
      {
        name: 'Buñuelos Tradicionales',
        description: 'Tres buñuelos bañados en miel de chancaca con higos aromáticos',
        price: 12.0,
      },
    ],
  },
];

const TABLES_DATA = [
  { tableNumber: 1, capacity: 4 },
  { tableNumber: 2, capacity: 4 },
  { tableNumber: 3, capacity: 2 },
  { tableNumber: 4, capacity: 2 },
  { tableNumber: 5, capacity: 6 },
  { tableNumber: 6, capacity: 6 },
  { tableNumber: 7, capacity: 4 },
  { tableNumber: 8, capacity: 4 },
  { tableNumber: 9, capacity: 8 },
  { tableNumber: 10, capacity: 8 },
  { tableNumber: 11, capacity: 4 },
  { tableNumber: 12, capacity: 6 },
];

async function main(): Promise<void> {
  // 1. Administrador inicial
  const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (admins === 0) {
    const username = (process.env.INITIAL_ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const password = process.env.INITIAL_ADMIN_PASSWORD || 'admin-picanteria-123';
    await prisma.user.create({
      data: {
        fullName: 'Administrador General',
        username,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        role: 'ADMIN',
      },
    });
    console.log(`✓ Administrador inicial "${username}" creado.`);
  }

  // 2. Semilla de Categorías y Platos
  for (const catData of CATEGORIES_DATA) {
    let category = await prisma.menuCategory.findFirst({
      where: { name: catData.name },
    });
    if (!category) {
      category = await prisma.menuCategory.create({
        data: {
          name: catData.name,
          sortOrder: catData.sortOrder,
          isActive: true,
        },
      });
      console.log(`✓ Categoría "${category.name}" creada.`);
    }

    for (const itemData of catData.items) {
      const existing = await prisma.menuItem.findFirst({
        where: { categoryId: category.id, name: itemData.name },
      });
      if (!existing) {
        await prisma.menuItem.create({
          data: {
            categoryId: category.id,
            name: itemData.name,
            description: itemData.description,
            price: itemData.price,
            isAvailable: true,
            isActive: true,
          },
        });
      }
    }
  }
  console.log('✓ Carta tradicional arequipeña inicializada.');

  // 3. Semilla de Mesas (12 mesas de picantería)
  for (const table of TABLES_DATA) {
    await prisma.diningTable.upsert({
      where: { tableNumber: table.tableNumber },
      update: { capacity: table.capacity },
      create: {
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        status: 'LIBRE',
      },
    });
  }
  console.log(`✓ ${TABLES_DATA.length} mesas del local dadas de alta en estado LIBRE.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
