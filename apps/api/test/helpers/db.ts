import type { PrismaService } from '../../src/prisma/prisma.service';

/** Deja la base de pruebas vacía antes de cada prueba. */
export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.diningTable.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}
