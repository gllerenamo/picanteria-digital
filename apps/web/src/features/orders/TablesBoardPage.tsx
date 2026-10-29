import type { TableOverview } from '@picanteria/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../../lib/api-client';
import { useOpenTable, useTablesBoard } from './api';
import { OpenTableDialog } from './OpenTableDialog';
import { TableCard } from './TableCard';
import { useOrdersRealtime } from './useOrdersRealtime';

/** Pantalla inicial del mozo (/mozo): todas las mesas con su estado (Historia 1). */
export function TablesBoardPage() {
  useOrdersRealtime();
  const navigate = useNavigate();
  const { data: tables, isPending, isError } = useTablesBoard();
  const openTable = useOpenTable();
  const [opening, setOpening] = useState<TableOverview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSelect = (table: TableOverview) => {
    setNotice(null);
    if (table.order) {
      void navigate(`/mozo/pedidos/${table.order.id}`);
    } else {
      setOpening(table);
    }
  };

  const onConfirmOpen = (guestCount: number | null) => {
    if (!opening) return;
    openTable.mutate(
      { tableId: opening.id, guestCount },
      {
        onSuccess: (order) => {
          void navigate(`/mozo/pedidos/${order.id}`);
        },
        onError: (error) => {
          setOpening(null);
          setNotice(error instanceof ApiError ? error.message : 'No se pudo abrir la mesa. Inténtalo de nuevo.');
        },
      },
    );
  };

  return (
    <section className="flex flex-col gap-4">
      {/* El título "Mozo" lo exige la prueba [001] AC-2.5. */}
      <h1 className="text-3xl font-bold">Mozo</h1>
      <p className="text-lg text-muted">Toca una mesa libre para abrirla o una ocupada para ver su pedido.</p>
      {notice && (
        <p role="alert" className="rounded-lg border border-danger px-4 py-3 text-lg text-danger">
          {notice}
        </p>
      )}
      {isPending && <p className="text-lg text-muted">Cargando mesas…</p>}
      {isError && <p className="text-lg text-danger">No se pudieron cargar las mesas.</p>}
      {tables && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Mesas">
          {tables.map((table) => (
            <li key={table.id} className="flex flex-col">
              <TableCard table={table} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}
      {opening && (
        <OpenTableDialog
          tableNumber={opening.tableNumber}
          pending={openTable.isPending}
          onConfirm={onConfirmOpen}
          onCancel={() => {
            setOpening(null);
          }}
        />
      )}
    </section>
  );
}
