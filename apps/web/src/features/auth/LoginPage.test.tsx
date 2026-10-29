import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderRoutes } from '../../../tests/render';
import { server } from '../../../tests/msw/server';
import { LoginPage } from './LoginPage';

const mozo = {
  id: '6f1c2b8e-1d2a-4c3b-9e4f-1a2b3c4d5e6f',
  fullName: 'Juan Mamani',
  username: 'mozo1',
  role: 'WAITER',
  homePath: '/mozo',
};

function renderLogin() {
  return renderRoutes(
    [
      { path: '/ingresar', element: <LoginPage /> },
      { path: '/mozo', element: <p>Pantalla de mozo</p> },
    ],
    '/ingresar',
  );
}

async function fillAndSubmit(username: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Usuario'), username);
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    server.use(http.get('*/api/auth/me', () => HttpResponse.json({ code: 'UNAUTHENTICATED', message: 'x' }, { status: 401 })));
  });

  it('muestra el mensaje genérico ante credenciales incorrectas', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ code: 'INVALID_CREDENTIALS', message: 'Usuario o contraseña incorrectos' }, { status: 401 }),
      ),
    );
    renderLogin();
    await fillAndSubmit('mozo1', 'incorrecta');
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos');
  });

  it('muestra el aviso de cuenta bloqueada', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { code: 'ACCOUNT_LOCKED', message: 'Cuenta bloqueada por intentos fallidos. Inténtalo de nuevo en 15 minutos.' },
          { status: 423 },
        ),
      ),
    );
    renderLogin();
    await fillAndSubmit('cocina1', 'clave-correcta');
    expect(await screen.findByRole('alert')).toHaveTextContent('Cuenta bloqueada por intentos fallidos');
  });

  it('se envía con la tecla Intro y lleva a la pantalla inicial del rol', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.json(mozo)));
    renderLogin();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Usuario'), 'mozo1');
    await user.type(screen.getByLabelText('Contraseña'), 'clave-segura-123{Enter}');
    expect(await screen.findByText('Pantalla de mozo')).toBeInTheDocument();
  });

  it('ante un error de red muestra el aviso y conserva lo escrito', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.error()));
    renderLogin();
    await fillAndSubmit('mozo1', 'clave-segura-123');
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión. Inténtalo de nuevo.');
    expect(screen.getByLabelText('Usuario')).toHaveValue('mozo1');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('clave-segura-123');
  });

  it('valida los campos vacíos en español sin llamar a la API', async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresa tu usuario');
  });

  it('configura los campos para el teclado de una tablet', async () => {
    renderLogin();
    expect(await screen.findByLabelText('Usuario')).toHaveAttribute('autocapitalize', 'none');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });
});
