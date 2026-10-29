import { HttpStatus, Injectable } from '@nestjs/common';
import type { OpenOrderRequest, OrderDetail, TableOverview, TableStatusChangedPayload, UpdateOrderRequest } from '@picanteria/shared';
import { Prisma } from '@prisma/client';
import { AppException } from '../common/app.exception';
import { TablesService } from '../menu/tables.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { lockOpenOrder } from './order-locks';
import { ORDER_DETAIL_INCLUDE, TABLE_OVERVIEW_INCLUDE, toOrderDetail, toTableOverview, type Viewer } from './order-mapper';

/** Mesas y pedido: tablero, abrir, detalle, comensales y cancelar la apertura. */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tables: TablesService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async listTables(): Promise<TableOverview[]> {
    const tables = await this.prisma.diningTable.findMany({
      orderBy: { tableNumber: 'asc' },
      include: TABLE_OVERVIEW_INCLUDE,
    });
    return tables.map(toTableOverview);
  }

  /** Abre una mesa libre: mesa `LIBRE → OCUPADA` y pedido nuevo en una transacción (FR-002, FR-003). */
  async open(input: OpenOrderRequest, viewer: Viewer): Promise<OrderDetail> {
    let order;
    try {
      order = await this.prisma.$transaction(async (tx) => {
        const opened = await this.tables.transition(tx, input.tableId, ['LIBRE'], 'OCUPADA');
        if (!opened) throw await this.tableNotAvailable(tx, input.tableId);
        return tx.order.create({
          data: { tableId: input.tableId, waiterId: viewer.id, guestCount: input.guestCount ?? null },
          include: ORDER_DETAIL_INCLUDE,
        });
      });
    } catch (error) {
      // Respaldo del índice único parcial: otra orden abierta para la misma mesa.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw await this.tableNotAvailable(this.prisma, input.tableId);
      }
      throw error;
    }
    this.tableStatusChanged({ tableId: order.tableId, tableNumber: order.table.tableNumber, status: 'OCUPADA', orderId: order.id });
    return toOrderDetail(order, viewer);
  }

  async getDetail(orderId: string, viewer: Viewer): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    if (!order) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'El pedido no existe' });
    return toOrderDetail(order, viewer);
  }

  /** Cualquier mozo registra o cambia los comensales mientras el pedido está abierto (FR-004). */
  async updateGuestCount(orderId: string, input: UpdateOrderRequest, viewer: Viewer): Promise<OrderDetail> {
    const order = await this.prisma.$transaction(async (tx) => {
      await lockOpenOrder(tx, orderId);
      return tx.order.update({ where: { id: orderId }, data: { guestCount: input.guestCount }, include: ORDER_DETAIL_INCLUDE });
    });
    return toOrderDetail(order, viewer);
  }

  /** Mesa `OCUPADA → POR_COBRAR` si no hay nada por enviar y hay consumo (FR-033). */
  async requestBill(orderId: string, viewer: Viewer): Promise<OrderDetail> {
    const order = await this.prisma.$transaction(async (tx) => {
      const locked = await lockOpenOrder(tx, orderId);
      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: { status: true, quantity: true, voidedQuantity: true },
      });
      if (items.some((item) => item.status === 'DRAFT')) {
        throw new AppException('HAS_UNSENT_ITEMS', HttpStatus.CONFLICT);
      }
      if (!items.some((item) => item.status !== 'VOIDED' && item.quantity > item.voidedQuantity)) {
        throw new AppException('NO_CONSUMPTION', HttpStatus.CONFLICT);
      }
      if (!(await this.tables.transition(tx, locked.tableId, ['OCUPADA'], 'POR_COBRAR'))) {
        const table = await tx.diningTable.findUniqueOrThrow({ where: { id: locked.tableId } });
        throw new AppException('TABLE_STATE_CONFLICT', HttpStatus.CONFLICT, { details: { current: table.status } });
      }
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    });
    this.tableStatusChanged({ tableId: order.tableId, tableNumber: order.table.tableNumber, status: 'POR_COBRAR', orderId });
    return toOrderDetail(order, viewer);
  }

  /** El responsable (o un administrador) cancela una apertura sin nada enviado (FR-006). */
  async cancel(orderId: string, viewer: Viewer): Promise<void> {
    const order = await this.prisma.$transaction(async (tx) => {
      const locked = await lockOpenOrder(tx, orderId);
      if (locked.waiterId !== viewer.id && viewer.role !== 'ADMIN') {
        throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN, {
          message: 'Solo el mozo que abrió la mesa puede cancelar la apertura',
        });
      }
      if ((await tx.kitchenDispatch.count({ where: { orderId } })) > 0) {
        throw new AppException('CANCEL_NOT_ALLOWED', HttpStatus.CONFLICT);
      }
      if (!(await this.tables.transition(tx, locked.tableId, ['OCUPADA'], 'LIBRE'))) {
        const table = await tx.diningTable.findUniqueOrThrow({ where: { id: locked.tableId } });
        throw new AppException('TABLE_STATE_CONFLICT', HttpStatus.CONFLICT, { details: { current: table.status } });
      }
      return tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', closedAt: new Date() },
        include: { table: true },
      });
    });
    this.tableStatusChanged({ tableId: order.tableId, tableNumber: order.table.tableNumber, status: 'LIBRE', orderId: order.id });
  }

  /** 409 para quien intenta abrir una mesa que ya no está libre, con el nombre de quien la abrió. */
  private async tableNotAvailable(db: Prisma.TransactionClient, tableId: string): Promise<AppException> {
    const table = await db.diningTable.findUnique({
      where: { id: tableId },
      include: { orders: { where: { status: 'OPEN' }, include: { waiter: { select: { id: true, fullName: true } } } } },
    });
    if (!table) return new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'La mesa no existe' });
    const openedBy = table.orders[0]?.waiter ?? null;
    return new AppException('TABLE_NOT_AVAILABLE', HttpStatus.CONFLICT, {
      ...(openedBy ? { message: `La mesa ya la abrió ${openedBy.fullName}` } : {}),
      details: { status: table.status, openedBy },
    });
  }

  /** Se llama después del commit (research.md §9). */
  private tableStatusChanged(change: Omit<TableStatusChangedPayload, 'changedAt'>): void {
    this.realtime.emitToRoles(['WAITER', 'CASHIER'], 'orders:table-status-changed', {
      ...change,
      changedAt: new Date().toISOString(),
    });
  }
}
