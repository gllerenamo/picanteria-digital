import {
  activeQuantity,
  canCancelOrder,
  canRequestBill,
  consumptionCents,
  money,
  toCents,
  type ConsumptionLine,
} from './order-mapper';

const line = (overrides: Partial<ConsumptionLine> = {}): ConsumptionLine => ({
  status: 'PENDING',
  quantity: 1,
  voidedQuantity: 0,
  unitPriceCents: 2450,
  ...overrides,
});

describe('order-mapper: cálculos del pedido', () => {
  it('formatea montos en soles con dos decimales', () => {
    expect(money(2450)).toEqual({ amount: 24.5, formatted: 'S/ 24.50' });
    expect(money(0)).toEqual({ amount: 0, formatted: 'S/ 0.00' });
    expect(toCents(28)).toBe(2800);
    expect(toCents(16.9)).toBe(1690);
  });

  it('las unidades vigentes descuentan las anuladas', () => {
    expect(activeQuantity({ quantity: 3, voidedQuantity: 1 })).toBe(2);
    expect(activeQuantity({ quantity: 2, voidedQuantity: 2 })).toBe(0);
  });

  it('el consumo suma solo las unidades vigentes de los ítems enviados', () => {
    const lines = [
      line({ quantity: 2, unitPriceCents: 2800 }),
      line({ status: 'READY', quantity: 3, voidedQuantity: 1, unitPriceCents: 1000 }),
      line({ status: 'DRAFT', unitPriceCents: null }),
      line({ status: 'VOIDED', quantity: 1, voidedQuantity: 1 }),
    ];
    expect(consumptionCents(lines)).toBe(2 * 2800 + 2 * 1000);
    expect(consumptionCents([])).toBe(0);
  });

  it('solo el responsable o un administrador cancelan, y solo sin envíos', () => {
    const base = { orderStatus: 'OPEN' as const, dispatchCount: 0, waiterId: 'mozo-a' };
    expect(canCancelOrder({ ...base, viewer: { id: 'mozo-a', role: 'WAITER' } })).toBe(true);
    expect(canCancelOrder({ ...base, viewer: { id: 'mozo-b', role: 'WAITER' } })).toBe(false);
    expect(canCancelOrder({ ...base, viewer: { id: 'admin', role: 'ADMIN' } })).toBe(true);
    expect(canCancelOrder({ ...base, dispatchCount: 1, viewer: { id: 'mozo-a', role: 'WAITER' } })).toBe(false);
    expect(canCancelOrder({ ...base, orderStatus: 'CANCELLED', viewer: { id: 'mozo-a', role: 'WAITER' } })).toBe(false);
  });

  it('se pide la cuenta con la mesa ocupada, sin borradores y con consumo', () => {
    const base = { orderStatus: 'OPEN' as const, tableStatus: 'OCUPADA' as const };
    expect(canRequestBill({ ...base, lines: [line()] })).toBe(true);
    expect(canRequestBill({ ...base, lines: [line(), line({ status: 'DRAFT', unitPriceCents: null })] })).toBe(false);
    expect(canRequestBill({ ...base, lines: [] })).toBe(false);
    expect(canRequestBill({ ...base, lines: [line({ status: 'VOIDED', voidedQuantity: 1 })] })).toBe(false);
    expect(canRequestBill({ ...base, tableStatus: 'POR_COBRAR', lines: [line()] })).toBe(false);
  });
});
