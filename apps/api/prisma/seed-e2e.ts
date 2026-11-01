/**
 * Prepara la base para las pruebas extremo a extremo: recrea un usuario activo por rol con
 * las credenciales de prueba de e2e-users.json y borra los usuarios que crearon las pruebas
 * anteriores (prefijo "prueba."). Solo para entornos de desarrollo y pruebas.
 */
import { PrismaClient, type Role } from '@prisma/client';
import * as argon2 from 'argon2';
import e2eUsers from './e2e-users.json';

const TEST_CREATED_PREFIX = 'prueba.';
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const usernames = e2eUsers.map((user) => user.username);
  const stale = { OR: [{ username: { in: usernames } }, { username: { startsWith: TEST_CREATED_PREFIX } }] };

  // Pedidos de las pruebas (003): se borran antes que los usuarios porque sus claves foráneas
  // hacia users son Restrict. Solo los que tocaron usuarios de prueba, no los de la demo.
  const testOrders = await prisma.order.findMany({
    where: {
      OR: [
        { waiter: stale },
        { dispatches: { some: { sentBy: stale } } },
        { items: { some: { voids: { some: { voidedBy: stale } } } } },
      ],
    },
    select: { id: true },
  });
  const orderIds = testOrders.map((order) => order.id);
  // Lo que guardó cocina (004) sobre esos ítems va primero.
  const ofTestItems = { orderItem: { orderId: { in: orderIds } } };
  await prisma.kitchenVoidAck.deleteMany({ where: { itemVoid: ofTestItems } });
  await prisma.readyNotice.deleteMany({ where: ofTestItems });
  await prisma.orderItemStatusChange.deleteMany({ where: ofTestItems });
  await prisma.itemVoid.deleteMany({ where: { orderItem: { orderId: { in: orderIds } } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.kitchenDispatch.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });

  await prisma.session.deleteMany({ where: { user: stale } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TEST_CREATED_PREFIX } } });

  for (const user of e2eUsers) {
    const data = {
      fullName: user.fullName,
      role: user.role as Role,
      passwordHash: await argon2.hash(user.password, { type: argon2.argon2id }),
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };
    await prisma.user.upsert({ where: { username: user.username }, update: data, create: { ...data, username: user.username } });
  }
  console.log(`Usuarios de prueba listos: ${usernames.join(', ')}`);

  // Semilla de mesas para pruebas e2e
  for (let i = 1; i <= 12; i++) {
    await prisma.diningTable.upsert({
      where: { tableNumber: i },
      update: {},
      create: { tableNumber: i, capacity: i % 2 === 0 ? 6 : 4, status: 'LIBRE' },
    });
  }
  // El upsert no reinicia el estado: las mesas sin pedido abierto vuelven a LIBRE.
  await prisma.diningTable.updateMany({
    where: { tableNumber: { gte: 1, lte: 12 }, orders: { none: { status: 'OPEN' } } },
    data: { status: 'LIBRE' },
  });
  console.log('Mesas de prueba listas (1..12)');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
