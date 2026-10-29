/**
 * Crea el administrador inicial si todavía no existe ninguno (research.md §15).
 * Las credenciales se leen del entorno; nunca se guardan en el repositorio.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (admins > 0) {
    console.log('Ya existe un administrador; no se crea otro.');
    return;
  }

  const username = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('Define INITIAL_ADMIN_USERNAME e INITIAL_ADMIN_PASSWORD para crear el administrador inicial');
  }
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    throw new Error('INITIAL_ADMIN_USERNAME debe tener de 3 a 30 caracteres: letras sin tildes, números, punto, guion o guion bajo');
  }
  if (password.length < 8 || password.length > 128) {
    throw new Error('INITIAL_ADMIN_PASSWORD debe tener entre 8 y 128 caracteres');
  }

  await prisma.user.create({
    data: {
      fullName: 'Administrador',
      username,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: 'ADMIN',
    },
  });
  console.log(`Administrador inicial "${username}" creado.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
