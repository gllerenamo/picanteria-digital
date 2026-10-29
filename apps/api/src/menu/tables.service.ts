import { Injectable } from '@nestjs/common';
import type { DiningTableResponse } from '@picanteria/shared';
import type { Prisma, TableStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<DiningTableResponse[]> {
    const tables = await this.prisma.diningTable.findMany({
      orderBy: { tableNumber: 'asc' },
    });
    return tables.map((t) => ({
      id: t.id,
      tableNumber: t.tableNumber,
      capacity: t.capacity,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  }

  /**
   * Cambia el estado de una mesa solo si sigue en uno de los estados esperados. Se llama dentro
   * de la transacción de quien cambia el pedido (003) o lo cobra (005), para que mesa y pedido
   * cambien juntos (specs/003-mesas-pedidos/research.md §2). Devuelve si cambió la mesa.
   */
  async transition(
    tx: Prisma.TransactionClient,
    tableId: string,
    from: readonly TableStatus[],
    to: TableStatus,
  ): Promise<boolean> {
    const { count } = await tx.diningTable.updateMany({
      where: { id: tableId, status: { in: [...from] } },
      data: { status: to },
    });
    return count === 1;
  }
}
