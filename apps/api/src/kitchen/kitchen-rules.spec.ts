import { canUndo, nextStatus, previousStatus, ticketTiming, withinCompletedWindow } from './kitchen-rules';

const at = (minutes: number): Date => new Date(Date.UTC(2026, 9, 29, 12, minutes));

describe('Reglas de cocina (004)', () => {
  it('avanza un solo paso: Pendiente → En preparación → Listo', () => {
    expect(nextStatus('PENDING')).toBe('PREPARING');
    expect(nextStatus('PREPARING')).toBe('READY');
  });

  it('"Deshacer" retrocede un paso', () => {
    expect(previousStatus('READY')).toBe('PREPARING');
    expect(previousStatus('PREPARING')).toBe('PENDING');
  });

  it('la comanda está activa mientras algún plato no anulado no esté listo', () => {
    expect(ticketTiming([{ status: 'READY', readyAt: at(5) }, { status: 'PREPARING', readyAt: null }])).toEqual({
      state: 'ACTIVE',
      completedAt: null,
    });
  });

  it('se completa con el último "Listo" e ignora los anulados', () => {
    const timing = ticketTiming([
      { status: 'READY', readyAt: at(5) },
      { status: 'VOIDED', readyAt: null },
      { status: 'READY', readyAt: at(9) },
    ]);
    expect(timing).toEqual({ state: 'COMPLETED', completedAt: at(9) });
  });

  it('una comanda con todos sus platos anulados queda anulada', () => {
    expect(ticketTiming([{ status: 'VOIDED', readyAt: null }]).state).toBe('VOIDED');
  });

  it('la ventana de "Completadas" dura 30 minutos', () => {
    expect(withinCompletedWindow(at(0), at(29))).toBe(true);
    expect(withinCompletedWindow(at(0), at(30))).toBe(false);
  });

  it('solo se deshace un paso dado, dentro de la ventana y sin aviso visto', () => {
    const active = { state: 'ACTIVE' as const, completedAt: null };
    const completedLongAgo = { state: 'COMPLETED' as const, completedAt: at(0) };
    expect(canUndo({ status: 'PENDING', noticeSeen: false }, active, at(1))).toBe(false);
    expect(canUndo({ status: 'VOIDED', noticeSeen: false }, active, at(1))).toBe(false);
    expect(canUndo({ status: 'PREPARING', noticeSeen: false }, active, at(1))).toBe(true);
    expect(canUndo({ status: 'READY', noticeSeen: false }, completedLongAgo, at(10))).toBe(true);
    expect(canUndo({ status: 'READY', noticeSeen: true }, completedLongAgo, at(10))).toBe(false);
    expect(canUndo({ status: 'READY', noticeSeen: false }, completedLongAgo, at(31))).toBe(false);
  });
});
