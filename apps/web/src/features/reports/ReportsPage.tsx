import { PAYMENT_METHOD_LABELS, REPORT_MAX_DAYS, daysBetween, type TopDishesSort } from '@picanteria/shared';
import { useId, useState } from 'react';
import { formatDate } from '../billing/money';
import { useSalesReport, useTopDishes, type DateRange } from './api';

type Tab = 'sales' | 'dishes';

/** Fecha `YYYY-MM-DD` de hoy en la zona de Perú. */
function todayInLima(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(now);
}

/** Mes actual completo: del día 1 al último día del mes (rango por defecto). */
export function currentMonth(now: Date = new Date()): DateRange {
  const [year = '1970', month = '01'] = todayInLima(now).split('-');
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${String(lastDay).padStart(2, '0')}` };
}

function rangeError(range: DateRange): string | null {
  if (!range.from || !range.to) return 'Elige las dos fechas';
  const days = daysBetween(range.from, range.to);
  if (days < 0 || days + 1 > REPORT_MAX_DAYS) return 'Elige un rango válido de hasta 366 días';
  return null;
}

const inputClass = 'touch-target h-12 rounded-lg border border-line px-3 text-lg';

/** Reportes del administrador (/admin/reportes): ventas y platos más vendidos (US4, US5). */
export function ReportsPage() {
  const id = useId();
  const [draft, setDraft] = useState<DateRange>(() => currentMonth());
  const [tab, setTab] = useState<Tab>('sales');
  const error = rangeError(draft);
  // Mientras el rango escrito no es válido se sigue mostrando el último válido.
  const [range, setRange] = useState<DateRange>(draft);
  if (!error && (draft.from !== range.from || draft.to !== range.to)) setRange(draft);

  const tabClass = (active: boolean) =>
    `touch-target flex-1 rounded-lg px-4 text-lg font-semibold sm:flex-none ${active ? 'bg-brand text-white' : 'border border-line bg-card'}`;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Reportes</h1>
      <div className="flex flex-wrap items-end gap-4" role="group" aria-label="Rango de fechas">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-from`} className="text-base font-medium">
            Desde
          </label>
          <input
            id={`${id}-from`}
            type="date"
            value={draft.from}
            onChange={(event) => {
              setDraft({ ...draft, from: event.target.value });
            }}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-to`} className="text-base font-medium">
            Hasta
          </label>
          <input
            id={`${id}-to`}
            type="date"
            value={draft.to}
            onChange={(event) => {
              setDraft({ ...draft, to: event.target.value });
            }}
            className={inputClass}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-lg text-danger">
          {error}
        </p>
      )}

      <div role="tablist" aria-label="Reportes" className="flex flex-wrap gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sales'}
          className={tabClass(tab === 'sales')}
          onClick={() => {
            setTab('sales');
          }}
        >
          Ventas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'dishes'}
          className={tabClass(tab === 'dishes')}
          onClick={() => {
            setTab('dishes');
          }}
        >
          Platos más vendidos
        </button>
      </div>

      {tab === 'sales' ? <SalesTab range={range} /> : <DishesTab range={range} />}
    </section>
  );
}

function SalesTab({ range }: { range: DateRange }) {
  const { data: report, isPending, isError } = useSalesReport(range);
  if (isPending) return <p className="text-lg text-muted">Cargando ventas…</p>;
  if (isError) return <p className="text-lg text-danger">No se pudieron cargar las ventas.</p>;

  return (
    <div role="tabpanel" aria-label="Ventas" className="flex flex-col gap-4">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ['Total vendido', report.total.formatted],
          ['Cuentas cobradas', String(report.accountsCount)],
          ['Ticket promedio', report.averageTicket.formatted],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 rounded-lg border border-line bg-card p-4">
            <dt className="text-base text-muted">{label}</dt>
            <dd className="text-2xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      {report.byDay.length === 0 && <p className="text-lg text-muted">No hay ventas en este rango</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {report.byDay.length > 0 && (
          <section className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4" aria-label="Ventas por día">
            <h2 className="text-xl font-bold">Por día</h2>
            <table className="w-full text-lg">
              <thead>
                <tr className="border-b border-line text-left text-base text-muted">
                  <th className="py-1 font-medium">Día</th>
                  <th className="py-1 text-right font-medium">Cuentas</th>
                  <th className="py-1 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.byDay.map((day) => (
                  <tr key={day.date} className="border-b border-line">
                    <td className="py-1">{formatDate(day.date)}</td>
                    <td className="py-1 text-right">{day.accountsCount}</td>
                    <td className="py-1 text-right">{day.total.formatted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <section className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4" aria-label="Ventas por método">
          <h2 className="text-xl font-bold">Por método de pago</h2>
          <table className="w-full text-lg">
            <tbody>
              {report.byMethod.map((line) => (
                <tr key={line.method} className="border-b border-line">
                  <td className="py-1">{PAYMENT_METHOD_LABELS[line.method]}</td>
                  <td className="py-1 text-right">{line.total.formatted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

const SORT_LABELS: Record<TopDishesSort, string> = { units: 'Por unidades', amount: 'Por monto' };

function DishesTab({ range }: { range: DateRange }) {
  const [sortBy, setSortBy] = useState<TopDishesSort>('units');
  const { data: dishes, isPending, isError } = useTopDishes(range, sortBy);

  return (
    <div role="tabpanel" aria-label="Platos más vendidos" className="flex flex-col gap-4">
      <div role="group" aria-label="Ordenar" className="flex flex-wrap gap-2">
        {(Object.keys(SORT_LABELS) as TopDishesSort[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={sortBy === option}
            onClick={() => {
              setSortBy(option);
            }}
            className={`touch-target rounded-lg px-4 text-lg font-medium ${sortBy === option ? 'bg-ink text-white' : 'border border-line bg-card'}`}
          >
            {SORT_LABELS[option]}
          </button>
        ))}
      </div>
      {isPending && <p className="text-lg text-muted">Cargando platos…</p>}
      {isError && <p className="text-lg text-danger">No se pudieron cargar los platos.</p>}
      {dishes?.length === 0 && <p className="text-lg text-muted">No hay ventas en este rango</p>}
      {dishes && dishes.length > 0 && (
        <table className="w-full rounded-lg bg-card text-lg" aria-label="Ranking de platos">
          <thead>
            <tr className="border-b border-line text-left text-base text-muted">
              <th className="px-2 py-1 font-medium">Puesto</th>
              <th className="px-2 py-1 font-medium">Plato</th>
              <th className="px-2 py-1 text-right font-medium">Unidades</th>
              <th className="px-2 py-1 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {dishes.map((dish) => (
              <tr key={dish.menuItem.id} className="border-b border-line">
                <td className="px-2 py-1">{dish.rank}</td>
                <td className="px-2 py-1">{dish.menuItem.name}</td>
                <td className="px-2 py-1 text-right">{dish.units}</td>
                <td className="px-2 py-1 text-right">{dish.amount.formatted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
