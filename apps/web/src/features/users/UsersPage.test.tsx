import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { mockSession } from '../../../tests/fixtures';
import { server } from '../../../tests/msw/server';
import { renderRoutes } from '../../../tests/render';
import { UsersPage } from './UsersPage';

const users = [
  {
    id: '6f1c2b8e-1d2a-4c3b-9e4f-1a2b3c4d5e6f',
    fullName: 'Administradora',
    username: 'admin',
    role: 'ADMIN',
    isActive: true,
    createdAt: '2026-10-28T12:00:00.000Z',
  },
  {
    id: '4f1c2b8e-1d2a-4c3b-9e4f-1a2b3c4d5e6f',
    fullName: 'Rosa Flores',
    username: 'rosa',
    role: 'CASHIER',
    isActive: true,
    createdAt: '2026-10-28T12:00:00.000Z',
  },
];

function renderPage() {
  mockSession('ADMIN', { id: users[0]!.id, fullName: 'Administradora', username: 'admin' });
  server.use(http.get('*/api/users', () => HttpResponse.json(users)));
  return renderRoutes([{ path: '/admin/usuarios', element: <UsersPage /> }], '/admin/usuarios');
}

describe('UsersPage', () => {
  it('lista a los usuarios con nombre completo, usuario, rol y estado', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers.slice(0, 4)).toEqual(['Nombre completo', 'Usuario', 'Rol', 'Estado']);
    const row = within(table).getByRole('row', { name: /Rosa Flores/ });
    expect(row).toHaveTextContent('rosa');
    expect(row).toHaveTextContent('Cajero');
    expect(row).toHaveTextContent('Activo');
  });

  it('pide confirmación antes de desactivar y solo entonces llama a la API', async () => {
    let request: unknown = null;
    server.use(
      http.patch('*/api/users/:id/status', async ({ request: req }) => {
        request = await req.json();
        return HttpResponse.json({ ...users[1], isActive: false });
      }),
    );
    renderPage();
    const user = userEvent.setup();
    const row = await screen.findByRole('row', { name: /Rosa Flores/ });
    await user.click(within(row).getByRole('button', { name: 'Desactivar' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('¿Desactivar a Rosa Flores? No podrá ingresar al sistema.');
    expect(request).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
    await screen.findByRole('row', { name: /Rosa Flores/ });
    expect(request).toEqual({ isActive: false });
  });

  it('cancelar la confirmación no desactiva al usuario', async () => {
    let called = false;
    server.use(
      http.patch('*/api/users/:id/status', () => {
        called = true;
        return HttpResponse.json(users[1]);
      }),
    );
    renderPage();
    const user = userEvent.setup();
    const row = await screen.findByRole('row', { name: /Rosa Flores/ });
    await user.click(within(row).getByRole('button', { name: 'Desactivar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(called).toBe(false);
  });
});
