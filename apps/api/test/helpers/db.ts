import type { PrismaService } from '../../src/prisma/prisma.service';

/** Deja la base de pruebas vacía antes de cada prueba, en orden de claves foráneas. */
export async function resetDb(prisma: PrismaService): Promise<void> {
  // 005-caja-reportes primero: sus filas apuntan a pedidos, ítems y usuarios.
  await prisma.payment.deleteMany();
  await prisma.billPartItem.deleteMany();
  await prisma.billPart.deleteMany();
  await prisma.billSplit.deleteMany();
  await prisma.dayClosure.deleteMany();
  await prisma.kitchenVoidAck.deleteMany();
  await prisma.readyNotice.deleteMany();
  await prisma.orderItemStatusChange.deleteMany();
  await prisma.itemVoid.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.kitchenDispatch.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.diningTable.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}
