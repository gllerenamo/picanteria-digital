import { useNavigate } from 'react-router';
import { useCurrentUser } from './session';

/** Aviso de acceso denegado (AC-2.2, AC-2.6). */
export function ForbiddenPage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  return (
    <section className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-bold">No tienes permiso para ver esta pantalla</h1>
      <p className="text-lg text-muted">Esta pantalla corresponde a otra función del personal.</p>
      <button
        type="button"
        onClick={() => {
          void navigate(user?.homePath ?? '/ingresar', { replace: true });
        }}
        className="touch-target rounded-lg bg-brand px-5 text-lg font-semibold text-white active:bg-brand-dark"
      >
        Volver a mi inicio
      </button>
    </section>
  );
}
