import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api-client';
import { CreateUserForm, EditUserForm } from './UserForm';

function renderCreate(error: unknown = null) {
  const onSubmit = vi.fn();
  render(<CreateUserForm onSubmit={onSubmit} onCancel={vi.fn()} pending={false} error={error} />);
  return { onSubmit, user: userEvent.setup() };
}

describe('CreateUserForm', () => {
  it('muestra los mensajes de validación en español y no envía', async () => {
    const { onSubmit, user } = renderCreate();
    await user.type(screen.getByLabelText('Nombre completo'), 'A');
    await user.type(screen.getByLabelText('Usuario'), 'ab');
    await user.type(screen.getByLabelText('Contraseña'), 'corta');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('El nombre completo debe tener al menos 2 caracteres')).toBeInTheDocument();
    expect(
      screen.getByText('El usuario debe tener de 3 a 30 caracteres: letras sin tildes, números, punto, guion o guion bajo'),
    ).toBeInTheDocument();
    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envía los datos válidos con el usuario en minúsculas', async () => {
    const { onSubmit, user } = renderCreate();
    await user.type(screen.getByLabelText('Nombre completo'), 'María Condori');
    await user.type(screen.getByLabelText('Usuario'), 'Maria.C');
    await user.type(screen.getByLabelText('Contraseña'), 'clave-mesa-123');
    await user.selectOptions(screen.getByLabelText('Rol'), 'Cocina');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).toHaveBeenCalledWith({
      fullName: 'María Condori',
      username: 'maria.c',
      password: 'clave-mesa-123',
      role: 'KITCHEN',
    });
  });

  it('muestra junto al campo el error de usuario repetido que devuelve la API', async () => {
    renderCreate(new ApiError('USERNAME_TAKEN', 'El nombre de usuario ya existe', 409));
    expect(await screen.findByText('El nombre de usuario ya existe')).toBeInTheDocument();
  });
});

describe('EditUserForm', () => {
  const rosa = {
    id: '4f1c2b8e-1d2a-4c3b-9e4f-1a2b3c4d5e6f',
    fullName: 'Rosa Flores',
    username: 'rosa',
    role: 'CASHIER' as const,
    isActive: true,
    createdAt: '2026-10-28T12:00:00.000Z',
  };

  it('no permite cambiar el nombre de usuario y envía nombre y rol', async () => {
    const onSubmit = vi.fn();
    render(<EditUserForm user={rosa} onSubmit={onSubmit} onCancel={vi.fn()} pending={false} error={null} />);
    expect(screen.queryByLabelText('Usuario')).not.toBeInTheDocument();
    expect(screen.getByText('rosa')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Rol'), 'Mozo');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledWith({ fullName: 'Rosa Flores', role: 'WAITER' });
  });

  it('muestra el error de último administrador que devuelve la API', async () => {
    render(
      <EditUserForm
        user={{ ...rosa, role: 'ADMIN' }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        pending={false}
        error={new ApiError('LAST_ADMIN', 'Debe existir al menos un administrador activo', 409)}
      />,
    );
    expect(await screen.findByText('Debe existir al menos un administrador activo')).toBeInTheDocument();
  });
});
