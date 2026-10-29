import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { mockSession } from '../../../tests/fixtures';
import { server } from '../../../tests/msw/server';
import { renderRoutes } from '../../../tests/render';
import { MenuPage } from './MenuPage';

const mockMenuTree = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Entradas',
    sortOrder: 1,
    isActive: true,
    createdAt: '2026-10-28T12:00:00.000Z',
    updatedAt: '2026-10-28T12:00:00.000Z',
    items: [
      {
        id: 'aaaa1111-1111-1111-1111-111111111111',
        categoryId: '11111111-1111-1111-1111-111111111111',
        categoryName: 'Entradas',
        name: 'Rocoto Relleno',
        description: 'Con pastel de papa tradicional',
        price: 28.0,
        priceFormatted: 'S/ 28.00',
        isAvailable: true,
        isActive: true,
        createdAt: '2026-10-28T12:00:00.000Z',
        updatedAt: '2026-10-28T12:00:00.000Z',
      },
      {
        id: 'aaaa2222-2222-2222-2222-222222222222',
        categoryId: '11111111-1111-1111-1111-111111111111',
        categoryName: 'Entradas',
        name: 'Solterito de Queso',
        description: 'Haba, choclo, queso y aceituna',
        price: 16.0,
        priceFormatted: 'S/ 16.00',
        isAvailable: false,
        isActive: true,
        createdAt: '2026-10-28T12:00:00.000Z',
        updatedAt: '2026-10-28T12:00:00.000Z',
      },
    ],
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Fondos',
    sortOrder: 2,
    isActive: true,
    createdAt: '2026-10-28T12:00:00.000Z',
    updatedAt: '2026-10-28T12:00:00.000Z',
    items: [
      {
        id: 'bbbb1111-1111-1111-1111-111111111111',
        categoryId: '22222222-2222-2222-2222-222222222222',
        categoryName: 'Fondos',
        name: 'Chupe de Camarones',
        description: 'Chupe tradicional de río',
        price: 45.0,
        priceFormatted: 'S/ 45.00',
        isAvailable: true,
        isActive: true,
        createdAt: '2026-10-28T12:00:00.000Z',
        updatedAt: '2026-10-28T12:00:00.000Z',
      },
    ],
  },
];

function renderMenuPage() {
  mockSession('ADMIN', { id: 'admin-id', fullName: 'Administrador', username: 'admin' });
  server.use(
    http.get('*/api/menu/tree', () => HttpResponse.json(mockMenuTree)),
    http.get('*/api/menu/categories', () =>
      HttpResponse.json(
        mockMenuTree.map((cat) => ({
          id: cat.id,
          name: cat.name,
          sortOrder: cat.sortOrder,
          isActive: cat.isActive,
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt,
        })),
      ),
    ),
  );
  return renderRoutes([{ path: '/admin/carta', element: <MenuPage /> }], '/admin/carta');
}

describe('MenuPage (Módulo Carta)', () => {
  it('muestra las categorías y los platos con precios en formato S/ y disponibilidad', async () => {
    renderMenuPage();
    expect(await screen.findByRole('heading', { name: 'Gestión de Carta' })).toBeInTheDocument();

    expect(screen.getByText('Rocoto Relleno')).toBeInTheDocument();
    expect(screen.getByText('S/ 28.00')).toBeInTheDocument();
    expect(screen.getByText('Chupe de Camarones')).toBeInTheDocument();
    expect(screen.getByText('S/ 45.00')).toBeInTheDocument();

    expect(screen.getAllByText('✓ Disponible')).toHaveLength(2);
    expect(screen.getByText('✕ Agotado')).toBeInTheDocument();
  });

  it('permite filtrar la visualización por categoría', async () => {
    renderMenuPage();
    await screen.findByText('Rocoto Relleno');

    const fondosTab = screen.getByRole('button', { name: /Fondos \(1\)/ });
    await userEvent.click(fondosTab);

    expect(screen.getByText('Chupe de Camarones')).toBeInTheDocument();
    expect(screen.queryByText('Rocoto Relleno')).not.toBeInTheDocument();
  });

  it('conmuta la disponibilidad del plato al pulsar el botón de estado', async () => {
    let patchedAvailability: unknown = null;
    server.use(
      http.patch('*/api/menu/items/:id/availability', async ({ request }) => {
        patchedAvailability = await request.json();
        return HttpResponse.json({
          ...mockMenuTree[0]?.items[0],
          isAvailable: false,
        });
      }),
    );

    renderMenuPage();
    const rocotoCard = (await screen.findByText('Rocoto Relleno')).closest('div');
    expect(rocotoCard).toBeInTheDocument();

    const toggleBtn = screen.getAllByRole('button', { name: '✓ Disponible' })[0];
    if (!toggleBtn) throw new Error('Toggle button not found');
    await userEvent.click(toggleBtn);

    expect(patchedAvailability).toEqual({ isAvailable: false });
  });

  it('abre el modal de nuevo plato al pulsar "+ Nuevo plato"', async () => {
    renderMenuPage();
    await screen.findByRole('heading', { name: 'Gestión de Carta' });

    const newBtn = screen.getByRole('button', { name: '+ Nuevo plato' });
    await userEvent.click(newBtn);

    expect(screen.getByRole('dialog', { name: 'Nuevo plato' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del plato')).toBeInTheDocument();
    expect(screen.getByLabelText('Precio (S/)')).toBeInTheDocument();
  });
});
