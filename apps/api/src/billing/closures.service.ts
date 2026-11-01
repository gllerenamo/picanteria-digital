import { HttpStatus, Injectable } from '@nestjs/common';
import type { ClosureCounts, ClosureSummary, ConfirmClosureRequest, DayClosure } from '@picanteria/shared';
import { Prisma } from '@prisma/client';
import { AppException } from '../common/app.exception';
import { money, toCents, type Viewer } from '../orders/order-mapper';
import { PrismaService } from '../prisma/prisma.service';
import { closureLines, type ClosureLineCents, type MethodAmounts } from './billing-math';

type Tx = Prisma.TransactionClient;

/** Bloqueo de asesoría que evita dos cierres a la vez (research.md §7). */
export const CLOSURE_LOCK_KEY = 5005;

const CLOSURE_INCLUDE = { cashier: { select: { id: true, fullName: true } } } satisfies Prisma.DayClosureInclude;
type ClosureRecord = Prisma.DayClosureGetPayload<{ include: typeof CLOSURE_INCLUDE }>;

interface Jornada {
  startedAt: Date | null;
  expected: MethodAmounts;
  accountsCount: number;
}

const cents = (amount: number): number => Math.round(amount * 100);
const decimal = (amountCents: number): Prisma.Decimal => new Prisma.Decimal(amountCents).div(100);
const countedOf = (counts: ClosureCounts): MethodAmounts => ({
  CASH: cents(counts.countedCash),
  YAPE_PLIN: cents(counts.countedYapePlin),
  CARD: cents(counts.countedCard),
});

function summary(startedAt: Date | null, lines: ClosureLineCents[], accountsCount: number, hasDifferences: boolean): ClosureSummary {
  return {
    startedAt: startedAt?.toISOString() ?? null,
    lines: lines.map((line) => ({
      method: line.method,
      expected: money(line.expected),
      counted: money(line.counted),
      difference: money(line.difference),
    })),
    total: money(lines.reduce((sum, line) => sum + line.expected, 0)),
    accountsCount,
    hasDifferences,
  };
}

function toDayClosure(record: ClosureRecord): DayClosure {
  const { lines, hasDifferences } = closureLines(
    { CASH: toCents(record.expectedCash), YAPE_PLIN: toCents(record.expectedYapePlin), CARD: toCents(record.expectedCard) },
    { CASH: toCents(record.countedCash), YAPE_PLIN: toCents(record.countedYapePlin), CARD: toCents(record.countedCard) },
  );
  return {
    ...summary(record.startedAt, lines, record.accountsCount, hasDifferences),
    id: record.id,
    closedAt: record.closedAt.toISOString(),
    cashier: record.cashier,
    notes: record.notes,
  };
}

/** Cierre del día con conteo a ciegas por método (FR-015 a FR-021). */
@Injectable()
export class ClosuresService {
  constructor(private readonly prisma: PrismaService) {}

  /** Compara lo contado con lo registrado sin guardar nada (AC-3.1, AC-3.2). */
  async preview(counts: ClosureCounts): Promise<ClosureSummary> {
    const jornada = await this.currentJornada(this.prisma);
    const { lines, hasDifferences } = closureLines(jornada.expected, countedOf(counts));
    return summary(jornada.startedAt, lines, jornada.accountsCount, hasDifferences);
  }

  /** Guarda el cierre y le asigna todos los pagos sin cierre, también los anulados (AC-3.3, AC-3.4). */
  async confirm(input: ConfirmClosureRequest, cashier: Viewer): Promise<DayClosure> {
    const record = await this.prisma.$transaction(async (tx) => {
      // $executeRaw: pg_advisory_xact_lock devuelve `void`, que $queryRaw no sabe leer.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CLOSURE_LOCK_KEY}::bigint)`;
      const jornada = await this.currentJornada(tx);
      const counted = countedOf(input);
      const { lines, hasDifferences } = closureLines(jornada.expected, counted);
      if (hasDifferences && !input.notes) throw new AppException('CLOSURE_NOTES_REQUIRED', HttpStatus.CONFLICT);

      const closure = await tx.dayClosure.create({
        data: {
          cashierId: cashier.id,
          startedAt: jornada.startedAt,
          // Hora tomada con el bloqueo ya adquirido: el siguiente cierre empieza aquí.
          closedAt: new Date(),
          expectedCash: decimal(jornada.expected.CASH),
          countedCash: decimal(counted.CASH),
          expectedYapePlin: decimal(jornada.expected.YAPE_PLIN),
          countedYapePlin: decimal(counted.YAPE_PLIN),
          expectedCard: decimal(jornada.expected.CARD),
          countedCard: decimal(counted.CARD),
          total: decimal(lines.reduce((sum, line) => sum + line.expected, 0)),
          accountsCount: jornada.accountsCount,
          notes: input.notes ?? null,
        },
        include: CLOSURE_INCLUDE,
      });
      await tx.payment.updateMany({ where: { closureId: null }, data: { closureId: closure.id } });
      return closure;
    });
    return toDayClosure(record);
  }

  /** Historial, más reciente primero (FR-021, AC-3.6). */
  async history(): Promise<DayClosure[]> {
    const records = await this.prisma.dayClosure.findMany({ include: CLOSURE_INCLUDE, orderBy: { closedAt: 'desc' } });
    return records.map(toDayClosure);
  }

  /**
   * Jornada en curso: los pagos sin cierre. Como el cierre exige todas las mesas libres, todos
   * pertenecen a cuentas ya pagadas (research.md §7).
   */
  private async currentJornada(db: Tx): Promise<Jornada> {
    const open = await db.order.findMany({
      where: { status: 'OPEN' },
      select: { table: { select: { tableNumber: true } } },
      orderBy: { table: { tableNumber: 'asc' } },
    });
    if (open.length > 0) {
      throw new AppException('CLOSURE_OPEN_TABLES', HttpStatus.CONFLICT, {
        details: { tables: open.map((order) => order.table.tableNumber) },
      });
    }

    const payments = await db.payment.findMany({
      where: { closureId: null },
      select: { orderId: true, method: true, amount: true, status: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    });
    const expected: MethodAmounts = { CASH: 0, YAPE_PLIN: 0, CARD: 0 };
    const orders = new Set<string>();
    for (const payment of payments) {
      if (payment.status !== 'VALID') continue;
      expected[payment.method] += toCents(payment.amount);
      orders.add(payment.orderId);
    }

    const previous = await db.dayClosure.findFirst({ orderBy: { closedAt: 'desc' }, select: { closedAt: true } });
    return {
      startedAt: previous?.closedAt ?? payments[0]?.paidAt ?? null,
      expected,
      accountsCount: orders.size,
    };
  }
}
