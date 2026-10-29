/** Mensaje de estado a pantalla completa (carga o error de conexión). */
export function StatusMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <p className="text-lg text-muted" role="status">
        {text}
      </p>
    </div>
  );
}
