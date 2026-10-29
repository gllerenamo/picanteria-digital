import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AppException } from '../common/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { VOID_NOT_FOUND } from './params';

/**
 * "Entendido" sobre una anulación (FR-024, FR-027). La anulación la registra la 003; cocina solo
 * guarda su confirmación, así que un aviso pendiente es una anulación sin confirmar
 * (research.md §5).
 */
@Injectable()
export class VoidNoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Idempotente: confirmar dos veces no falla ni avisa de nuevo. */
  async acknowledge(itemVoidId: string, user: AuthenticatedUser): Promise<void> {
    const itemVoid = await this.prisma.itemVoid.findUnique({ where: { id: itemVoidId }, select: { id: true } });
    if (!itemVoid) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: VOID_NOT_FOUND });
    const created = await this.prisma.kitchenVoidAck.createMany({
      data: [{ itemVoidId, acknowledgedById: user.id }],
      skipDuplicates: true,
    });
    // Al confirmarlo en una pantalla, desaparece de todas.
    if (created.count > 0) this.realtime.emitToRoles(['KITCHEN'], 'kitchen:void-acknowledged', { itemVoidId });
  }
}
