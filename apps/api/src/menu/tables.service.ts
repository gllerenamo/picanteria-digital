import { Injectable } from '@nestjs/common';
import type { DiningTableResponse } from '@picanteria/shared';
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
}
