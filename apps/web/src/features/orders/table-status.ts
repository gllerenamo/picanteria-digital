import type { TableStatus } from '@picanteria/shared';

/** Estado de la mesa con texto y color (nunca solo color, contraste WCAG AA). */
export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  LIBRE: 'Libre',
  OCUPADA: 'Ocupada',
  POR_COBRAR: 'Por cobrar',
};

export const TABLE_STATUS_STYLES: Record<TableStatus, string> = {
  LIBRE: 'border-success text-success',
  OCUPADA: 'border-brand text-brand',
  POR_COBRAR: 'border-ink text-ink',
};
