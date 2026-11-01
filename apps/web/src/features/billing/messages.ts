/** Textos compartidos por las pantallas de caja (Principio III). */

export const CASHIER_OFFLINE_MESSAGE = 'Sin conexión. Los cobros necesitan conexión; al volver verás los saldos actuales.';

/** Aviso que muestra /caja al volver de una cuenta pagada (estado de la navegación). */
export interface CashierNotice {
  notice: string;
}
