import {
  assignedAmountCents,
  changeCents,
  closureLines,
  isSplitStale,
  splitEqually,
  validateAssignment,
} from './billing-math';

describe('billing-math: cálculos de caja', () => {
  describe('splitEqually', () => {
    it('reparte S/ 100.00 en 3 partes con el céntimo sobrante en la primera', () => {
      expect(splitEqually(10000, 3)).toEqual([3334, 3333, 3333]);
    });

    it('reparte exacto cuando el saldo se divide sin resto', () => {
      expect(splitEqually(9000, 2)).toEqual([4500, 4500]);
    });

    it('la suma de las partes siempre es el saldo', () => {
      for (const [pending, parts] of [
        [1, 2],
        [9999, 7],
        [12345, 20],
      ] as const) {
        const result = splitEqually(pending, parts);
        expect(result).toHaveLength(parts);
        expect(result.reduce((a, b) => a + b, 0)).toBe(pending);
      }
    });
  });

  describe('validateAssignment', () => {
    const available = new Map([
      ['a', 3],
      ['b', 1],
    ]);

    it('acepta una asignación completa sin repetir unidades', () => {
      const check = validateAssignment(available, [
        { items: [{ orderItemId: 'a', units: 2 }] },
        { items: [{ orderItemId: 'a', units: 1 }, { orderItemId: 'b', units: 1 }] },
      ]);
      expect(check).toEqual({ unassigned: {}, overAssigned: {}, unknown: [], unassignedTotal: 0 });
    });

    it('cuenta las unidades sin asignar', () => {
      const check = validateAssignment(available, [{ items: [{ orderItemId: 'a', units: 1 }] }, { items: [] }]);
      expect(check.unassigned).toEqual({ a: 2, b: 1 });
      expect(check.unassignedTotal).toBe(3);
    });

    it('detecta unidades asignadas de más e ítems ajenos', () => {
      const check = validateAssignment(available, [
        { items: [{ orderItemId: 'a', units: 4 }, { orderItemId: 'b', units: 1 }] },
        { items: [{ orderItemId: 'x', units: 1 }] },
      ]);
      expect(check.overAssigned).toEqual({ a: 1 });
      expect(check.unknown).toEqual(['x']);
    });
  });

  it('assignedAmountCents suma unidades por el precio de envío de cada ítem', () => {
    const prices = new Map([
      ['a', 2800],
      ['b', 1550],
    ]);
    expect(
      assignedAmountCents(
        [
          { orderItemId: 'a', units: 2 },
          { orderItemId: 'b', units: 1 },
        ],
        prices,
      ),
    ).toBe(7150);
  });

  it('changeCents es lo recibido menos lo cobrado', () => {
    expect(changeCents(4250, 5000)).toBe(750);
    expect(changeCents(4250, 4250)).toBe(0);
    expect(changeCents(4250, 4000)).toBe(-250);
  });

  describe('closureLines', () => {
    it('calcula la diferencia contado − registrado por método', () => {
      const result = closureLines({ CASH: 10000, YAPE_PLIN: 5000, CARD: 0 }, { CASH: 9500, YAPE_PLIN: 5000, CARD: 0 });
      expect(result.lines).toEqual([
        { method: 'CASH', expected: 10000, counted: 9500, difference: -500 },
        { method: 'YAPE_PLIN', expected: 5000, counted: 5000, difference: 0 },
        { method: 'CARD', expected: 0, counted: 0, difference: 0 },
      ]);
      expect(result.hasDifferences).toBe(true);
    });

    it('sin diferencias cuando todo cuadra', () => {
      expect(closureLines({ CASH: 1, YAPE_PLIN: 2, CARD: 3 }, { CASH: 1, YAPE_PLIN: 2, CARD: 3 }).hasDifferences).toBe(false);
    });
  });

  describe('isSplitStale', () => {
    it('no está desactualizada si el saldo repartido sigue siendo el saldo', () => {
      expect(isSplitStale(10000, 7000, 3000)).toBe(false);
    });

    it('está desactualizada si el total cambió después de dividir', () => {
      expect(isSplitStale(12000, 7000, 3000)).toBe(true);
    });

    it('está desactualizada si cambió un pago que no es de sus partes', () => {
      expect(isSplitStale(10000, 7000, 0)).toBe(true);
    });
  });
});
