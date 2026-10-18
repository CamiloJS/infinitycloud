'use client';

import React from 'react';
import { useItems } from '@/context/ItemsContext';
import { useTheme } from '@/context/ThemeContext';
import { ProviderType, SortOption } from '@/types';
import { 
  Search, 
  X, 
  LayoutGrid, 
  List, 
  Plus, 
  ArrowUpDown, 
  Filter, 
  Menu,
  Sun,
  Moon
} from 'lucide-react';

interface HeaderProps {
  onOpenAddModal: () => void;
  onOpenNotionModal?: () => void;
  onToggleMobileMenu: () => void;
}

export function Header({
  onOpenAddModal,
  onToggleMobileMenu
}: HeaderProps) {
  const {
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    sortOption,
    setSortOption,
    selectedProvider,
    setSelectedProvider,
    activeView,
    activeCategory,
    collections,
    activeCollectionId
  } = useItems();

  const { resolvedTheme, toggleTheme } = useTheme();

  const providers: { id: ProviderType | 'all'; label: string }[] = [
    { id: 'all', label: 'Todos los proveedores' },
    { id: 'youtube', label: 'YouTube' },
    { id: 'drive', label: 'Google Drive' },
    { id: 'notion', label: 'Notion' },
    { id: 'soundcloud', label: 'SoundCloud' },
    { id: 'vimeo', label: 'Vimeo' },
    { id: 'direct', label: 'Directos' },
    { id: 'generic', label: 'Enlaces web' },
  ];

  // Header Title description
  let title = 'Todos los archivos';
  if (activeView === 'favorites') title = 'Archivos favoritos';
  else if (activeView === 'trash') title = 'Papelera de reciclaje';
  else if (activeCollectionId) {
    const coll = collections.find(c => c.id === activeCollectionId);
    if (coll) title = `Colección: ${coll.name}`;
  } else if (activeCategory !== 'all') {
    const map: Record<string, string> = {
      photos: 'Fotos',
      videos: 'Videos',
      music: 'Música',
      documents: 'Documentos',
      others: 'Otros archivos'
    };
    title = map[activeCategory] || activeCategory;
  }

  return (
    <header className="h-16 px-4 md:px-8 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-20 select-none">
      {/* Left: Mobile Menu & Current Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 md:hidden transition-colors"
        >
          <Menu size={20} />
        </button>

        <h1 className="font-bold text-base md:text-lg text-slate-800 dark:text-white truncate hidden sm:block">
          {title}
        </h1>
      </div>

      {/* Center: Wide Search Bar */}
      <div className="flex-1 max-w-xl relative">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre, URL o proveedor..."
          className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-slate-800 dark:text-white placeholder-slate-400 outline-none transition-all shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Right: Controls & Filters */}
      <div className="flex items-center gap-2">
        {/* Provider Filter */}
        <div className="relative hidden lg:block">
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as ProviderType | 'all')}
            className="text-xs font-medium py-2 px-3 pr-8 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none appearance-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <Filter size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Sort Dropdown */}
        <div className="relative hidden md:block">
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="text-xs font-medium py-2 px-3 pr-8 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none appearance-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            <option value="date-desc">Más recientes</option>
            <option value="date-asc">Más antiguos</option>
            <option value="name-asc">Nombre (A - Z)</option>
            <option value="name-desc">Nombre (Z - A)</option>
          </select>
          <ArrowUpDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title="Vista de cuadrícula"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title="Vista de lista"
          >
            <List size={16} />
          </button>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm"
          title={resolvedTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Mobile Add Button */}
        <button
          onClick={onOpenAddModal}
          className="md:hidden p-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md"
          title="Añadir enlace"
        >
          <Plus size={18} />
        </button>
      </div>
    </header>
  );
}
