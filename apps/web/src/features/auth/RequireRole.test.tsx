import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mockSession } from '../../../tests/fixtures';
import { renderRoutes } from '../../../tests/render';
import { RequireRole } from './RequireRole';

function renderWithRole(path: string, onCashierMount = vi.fn()) {
  function CashierScreen() {
    onCashierMount();
    return <h1>Pantalla de caja</h1>;
  }
  return renderRoutes(
    [
      {
        element: <RequireRole />,
        children: [
          { path: '/mozo', element: <h1>Pantalla de mozo</h1> },
          { path: '/caja', element: <CashierScreen /> },
          { path: '*', element: <h1>Ruta desconocida</h1> },
        ],
      },
    ],
    path,
  );
}

describe('RequireRole', () => {
  it('muestra la pantalla cuando el rol tiene permiso', async () => {
    mockSession('WAITER');
    renderWithRole('/mozo');
    expect(await screen.findByRole('heading', { name: 'Pantalla de mozo' })).toBeInTheDocument();
  });

  it('muestra el aviso de permiso sin montar la pantalla pedida', async () => {
    mockSession('WAITER');
    const onCashierMount = vi.fn();
    renderWithRole('/caja', onCashierMount);
    expect(await screen.findByRole('heading', { name: 'No tienes permiso para ver esta pantalla' })).toBeInTheDocument();
    expect(onCashierMount).not.toHaveBeenCalled();
  });

  it('"Volver a mi inicio" lleva a la pantalla inicial del rol', async () => {
    mockSession('WAITER');
    renderWithRole('/caja');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Volver a mi inicio' }));
    expect(await screen.findByRole('heading', { name: 'Pantalla de mozo' })).toBeInTheDocument();
  });

  it('el administrador puede abrir cualquier pantalla', async () => {
    mockSession('ADMIN');
    renderWithRole('/caja');
    expect(await screen.findByRole('heading', { name: 'Pantalla de caja' })).toBeInTheDocument();
  });

  it('deja pasar las rutas que no son pantallas de un rol', async () => {
    mockSession('KITCHEN');
    renderWithRole('/otra-cosa');
    expect(await screen.findByRole('heading', { name: 'Ruta desconocida' })).toBeInTheDocument();
  });
});
