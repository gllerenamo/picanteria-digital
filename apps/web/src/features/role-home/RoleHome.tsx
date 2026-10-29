import type { ReactNode } from 'react';
import { useCurrentUser } from '../auth/session';

interface RoleHomeProps {
  title: string;
  children?: ReactNode;
  /** Texto más grande para leer a distancia en la cocina (Principio IV). */
  large?: boolean;
}

/** Pantalla inicial de un rol; su contenido llegará con las features de pedidos, cocina y caja. */
export function RoleHome({ title, children, large = false }: RoleHomeProps) {
  const { data: user } = useCurrentUser();
  return (
    <section className={`flex flex-col gap-4 ${large ? 'text-kitchen' : 'text-lg'}`}>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="font-medium">Hola, {user?.fullName}</p>
      <p className="text-muted">{children ?? 'Las funciones de esta pantalla llegarán en las próximas versiones.'}</p>
    </section>
  );
}
