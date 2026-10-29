import { useState } from 'react';
import type { MenuItemResponse } from '@picanteria/shared';
import { StatusMessage } from '../../components/StatusMessage';
import { CategoryModal } from './CategoryModal';
import { MenuItemModal } from './MenuItemModal';
import { useCategories, useMenuTree, useSetItemActive, useToggleItemAvailability } from './api';

export function MenuPage() {
  const { data: tree, isLoading, isError } = useMenuTree();
  const { data: categories = [] } = useCategories();

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemResponse | null>(null);

  const toggleAvailabilityMutation = useToggleItemAvailability();
  const setStatusMutation = useSetItemActive();

  if (isLoading) return <StatusMessage text="Cargando la carta..." />;
  if (isError || !tree) return <StatusMessage text="Error al cargar la carta. Inténtalo de nuevo." />;

  const displayedCategories = selectedCatId
    ? tree.filter((c) => c.id === selectedCatId)
    : tree;

  const handleEditItem = (item: MenuItemResponse) => {
    setEditingItem(item);
    setIsItemModalOpen(true);
  };

  const handleNewItem = (catId?: string) => {
    setEditingItem(null);
    setSelectedCatId(catId || null);
    setIsItemModalOpen(true);
  };

  const handleToggleAvailability = async (item: MenuItemResponse) => {
    await toggleAvailabilityMutation.mutateAsync({
      id: item.id,
      isAvailable: !item.isAvailable,
    });
  };

  const handleDeactivateItem = async (item: MenuItemResponse) => {
    if (confirm(`¿Dar de baja el plato "${item.name}" de la carta?`)) {
      await setStatusMutation.mutateAsync({ id: item.id, isActive: false });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Gestión de Carta</h1>
          <p className="text-muted text-base mt-1">
            Administra platos, precios y disponibilidad del día ("se acabó el chupe").
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setIsCatModalOpen(true);
            }}
            className="min-h-[44px] rounded-xl border border-line bg-card px-4 py-2 font-medium shadow-sm"
          >
            + Nueva categoría
          </button>
          <button
            type="button"
            onClick={() => {
              handleNewItem();
            }}
            className="min-h-[44px] rounded-xl bg-brand px-5 py-2 font-semibold text-white shadow"
          >
            + Nuevo plato
          </button>
        </div>
      </div>

      {/* Filtro por categorías */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => {
            setSelectedCatId(null);
          }}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            selectedCatId === null
              ? 'bg-brand text-white shadow'
              : 'bg-card border border-line text-ink hover:bg-muted/10'
          }`}
        >
          Todas las categorías ({tree.reduce((acc, cat) => acc + cat.items.length, 0)})
        </button>
        {tree.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              setSelectedCatId(cat.id);
            }}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
              selectedCatId === cat.id
                ? 'bg-brand text-white shadow'
                : 'bg-card border border-line text-ink hover:bg-muted/10'
            }`}
          >
            {cat.name} ({cat.items.length})
          </button>
        ))}
      </div>

      {/* Listado de platos por categoría */}
      <div className="flex flex-col gap-8">
        {displayedCategories.map((category) => (
          <section key={category.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h2 className="text-2xl font-bold">{category.name}</h2>
              <button
                type="button"
                onClick={() => {
                  handleNewItem(category.id);
                }}
                className="text-sm font-medium text-brand hover:underline min-h-[44px] px-2 flex items-center"
              >
                + Agregar a {category.name}
              </button>
            </div>

            {category.items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-6 text-center text-muted">
                No hay platos registrados en esta categoría.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all ${
                      item.isAvailable ? 'bg-card border-line' : 'bg-muted/20 border-line opacity-75'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-bold">{item.name}</h3>
                        <span className="text-lg font-extrabold text-brand whitespace-nowrap">
                          {item.priceFormatted}
                        </span>
                      </div>
                      {item.description && (
                        <p className="mt-1 text-sm text-muted line-clamp-2">{item.description}</p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void handleToggleAvailability(item);
                        }}
                        className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          item.isAvailable
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                      >
                        {item.isAvailable ? '✓ Disponible' : '✕ Agotado'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            handleEditItem(item);
                          }}
                          className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-medium border border-line hover:bg-muted/10"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeactivateItem(item);
                          }}
                          className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Baja
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Modales */}
      {isItemModalOpen && (
        <MenuItemModal
          categories={categories}
          itemToEdit={editingItem}
          defaultCategoryId={selectedCatId || undefined}
          onClose={() => {
            setIsItemModalOpen(false);
          }}
        />
      )}

      {isCatModalOpen && (
        <CategoryModal
          nextOrder={categories.length + 1}
          onClose={() => {
            setIsCatModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
