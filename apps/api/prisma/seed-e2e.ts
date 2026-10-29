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
  console.log('Mesas de prueba listas (1..12)');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
