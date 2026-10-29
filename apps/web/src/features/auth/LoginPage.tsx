import { ERROR_MESSAGES, loginRequestSchema } from '@picanteria/shared';
import { useState, type SyntheticEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { StatusMessage } from '../../components/StatusMessage';
import { ApiError } from '../../lib/api-client';
import { useCurrentUser, useLogin } from './session';

/** Aviso que otra pantalla puede enviar al redirigir aquí (por ejemplo, cuenta desactivada). */
export interface LoginLocationState {
  notice?: string;
}

function noticeFrom(state: unknown): string | undefined {
  if (typeof state === 'object' && state !== null && 'notice' in state && typeof state.notice === 'string') {
    return state.notice;
  }
  return undefined;
}

export function LoginPage() {
  const { data: currentUser, isPending } = useCurrentUser();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (isPending) return <StatusMessage text="Cargando…" />;
  if (currentUser) return <Navigate to={currentUser.homePath} replace />;

  const notice = noticeFrom(location.state);
  const apiError = login.error instanceof ApiError ? login.error.message : login.error ? ERROR_MESSAGES.INTERNAL_ERROR : null;
  const errorMessage = validationError ?? apiError;

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = loginRequestSchema.safeParse({ username, password });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? ERROR_MESSAGES.VALIDATION_ERROR);
      return;
    }
    setValidationError(null);
    login.mutate(parsed.data, {
      onSuccess: (user) => {
        void navigate(user.homePath, { replace: true });
      },
    });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
        <p className="text-center text-sm font-semibold tracking-wide text-brand uppercase">Picantería Digital</p>
        <h1 className="mt-1 text-center text-3xl font-bold">Ingresar</h1>

        {notice && (
          <p className="mt-6 rounded-lg bg-amber-50 p-3 text-base text-amber-900" role="status">
            {notice}
          </p>
        )}

        <form className="mt-6 flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="username" className="text-base font-medium">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              spellCheck={false}
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
              }}
              className="touch-target h-12 rounded-lg border border-line px-3 text-lg focus:border-brand focus:outline-2 focus:outline-brand"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-base font-medium">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              className="touch-target h-12 rounded-lg border border-line px-3 text-lg focus:border-brand focus:outline-2 focus:outline-brand"
            />
          </div>

          {errorMessage && (
            <p className="rounded-lg bg-red-50 p-3 text-base text-danger" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="touch-target h-12 rounded-lg bg-brand text-lg font-semibold text-white active:bg-brand-dark disabled:opacity-60"
          >
            {login.isPending ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  );
}
