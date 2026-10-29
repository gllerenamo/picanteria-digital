/**
 * Aviso para mostrar en /ingresar la próxima vez que se abra (por ejemplo, cuando el
 * administrador desactiva la cuenta con la sesión abierta).
 */
export const ACCOUNT_DISABLED_NOTICE = 'Tu cuenta fue desactivada. Consulta al administrador.';

let pendingNotice: string | null = null;

export function setLoginNotice(notice: string): void {
  pendingNotice = notice;
}

export function readLoginNotice(): string | null {
  return pendingNotice;
}

export function clearLoginNotice(): void {
  pendingNotice = null;
}
