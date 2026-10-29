import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockSession } from '../../../tests/fixtures';
import { createQueryClient } from '../../app/providers';
import { clearSession, useCurrentUser } from './session';

function SessionStatus() {
  const { data: user, isPending } = useCurrentUser();
  if (isPending) return <p>Cargando</p>;
  return <p>{user ? `Sesión de ${user.fullName}` : 'Sin sesión'}</p>;
}

describe('clearSession', () => {
  it('avisa a los componentes ya montados que la sesión terminó y borra los demás datos', async () => {
    mockSession('KITCHEN', { fullName: 'Rosa Flores' });
    const client = createQueryClient();
    client.setQueryData(['users'], []);
    render(
      <QueryClientProvider client={client}>
        <SessionStatus />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Sesión de Rosa Flores')).toBeInTheDocument();

    act(() => {
      clearSession(client);
    });

    expect(await screen.findByText('Sin sesión')).toBeInTheDocument();
    expect(client.getQueryData(['users'])).toBeUndefined();
  });
});
