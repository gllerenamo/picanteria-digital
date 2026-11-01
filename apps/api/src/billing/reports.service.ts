import { HttpStatus, Injectable } from '@nestjs/common';
import {
  PAYMENT_METHODS,
  REPORT_MAX_DAYS,
  daysBetween,
  type DateRangeQuery,
  type PaymentMethod,
  type SalesReport,
  type TopDish,
  type TopDishesSort,
} from '@picanteria/shared';
import { Prisma } from '@prisma/client';
import { AppException } from '../common/app.exception';
import { money } from '../orders/order-mapper';
import { PrismaService } from '../prisma/prisma.service';

/** Zona horaria de los rangos y de los totales por día (FR-027). */
const TIME_ZONE = 'America/Lima';

interface DayRow {
  day: string;
  total_cents: bigint;
  accounts: bigint;
}

interface MethodRow {
  method: PaymentMethod;
  total_cents: bigint;
}

interface DishRow {
  id: string;
  name: string;
  units: bigint;
  amount_cents: bigint;
}

/**
 * Cuentas pagadas cuyo `closed_at` cae en `[from 00:00, to + 1 día 00:00)` de Lima. Usa el índice
 * `orders(status, closed_at)` (SC-007).
 */
function paidInRange(range: DateRangeQuery): Prisma.Sql {
  return Prisma.sql`o.status = 'PAID'
    AND o.closed_at >= (${range.from}::date)::timestamp AT TIME ZONE ${TIME_ZONE}
    AND o.closed_at < (${range.to}::date + 1)::timestamp AT TIME ZONE ${TIME_ZONE}`;
}

/** Reportes del administrador agregados en SQL (research.md §8, FR-022 a FR-025). */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ventas: solo pagos vigentes de cuentas pagadas; una cuenta cerrada sin cobro no tiene pagos (FR-024). */
  async sales(range: DateRangeQuery): Promise<SalesReport> {
    assertRange(range);
    const [days, methods] = await Promise.all([
      this.prisma.$queryRaw<DayRow[]>`
        SELECT to_char((o.closed_at AT TIME ZONE ${TIME_ZONE})::date, 'YYYY-MM-DD') AS day,
               (SUM(p.amount) * 100)::bigint AS total_cents,
               COUNT(DISTINCT o.id) AS accounts
        FROM orders o
        JOIN payments p ON p.order_id = o.id AND p.status = 'VALID'
        WHERE ${paidInRange(range)}
        GROUP BY 1
        ORDER BY 1`,
      this.prisma.$queryRaw<MethodRow[]>`
        SELECT p.method::text AS method, (SUM(p.amount) * 100)::bigint AS total_cents
        FROM orders o
        JOIN payments p ON p.order_id = o.id AND p.status = 'VALID'
        WHERE ${paidInRange(range)}
        GROUP BY 1`,
    ]);

    const totalCents = days.reduce((sum, row) => sum + Number(row.total_cents), 0);
    // Cada cuenta se cierra en un solo día: la suma por día es la cantidad del rango.
    const accountsCount = days.reduce((sum, row) => sum + Number(row.accounts), 0);
    const byMethod = new Map(methods.map((row) => [row.method, Number(row.total_cents)]));
    return {
      from: range.from,
      to: range.to,
      total: money(totalCents),
      accountsCount,
      averageTicket: money(accountsCount === 0 ? 0 : Math.round(totalCents / accountsCount)),
      byDay: days.map((row) => ({ date: row.day, total: money(Number(row.total_cents)), accountsCount: Number(row.accounts) })),
      byMethod: PAYMENT_METHODS.map((method) => ({ method, total: money(byMethod.get(method) ?? 0) })),
    };
  }

  /**
   * Platos más vendidos: unidades no anuladas de cuentas pagadas, al precio con que se envió
   * cada ítem (AC-5.3, AC-5.4); empates por nombre.
   */
  async topDishes(range: DateRangeQuery, sortBy: TopDishesSort): Promise<TopDish[]> {
    assertRange(range);
    const order = sortBy === 'amount' ? Prisma.sql`amount_cents DESC` : Prisma.sql`units DESC`;
    const rows = await this.prisma.$queryRaw<DishRow[]>`
      SELECT mi.id::text AS id, mi.name,
             SUM(oi.quantity - oi.voided_quantity)::bigint AS units,
             (SUM((oi.quantity - oi.voided_quantity) * oi.unit_price) * 100)::bigint AS amount_cents
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE ${paidInRange(range)}
        AND oi.status NOT IN ('DRAFT', 'VOIDED')
        AND oi.quantity > oi.voided_quantity
      GROUP BY mi.id, mi.name
      ORDER BY ${order}, mi.name ASC`;
    return rows.map((row, index) => ({
      rank: index + 1,
      menuItem: { id: row.id, name: row.name },
      units: Number(row.units),
      amount: money(Number(row.amount_cents)),
    }));
  }
}

/** `from` ≤ `to` y como máximo 366 días, contados ambos extremos. */
function assertRange(range: DateRangeQuery): void {
  const days = daysBetween(range.from, range.to);
  if (days < 0 || days + 1 > REPORT_MAX_DAYS) throw new AppException('INVALID_DATE_RANGE', HttpStatus.BAD_REQUEST);
}
