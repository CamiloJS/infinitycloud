'use client';

import React, { useState } from 'react';
import { useItems } from '@/context/ItemsContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Logo } from '@/components/ui/Logo';
import { CategoryType } from '@/types';
import { 
  Image, 
  Video, 
  Music, 
  FileText, 
  Archive, 
  Star, 
  Trash2, 
  Plus, 
  FolderPlus, 
  MoreVertical, 
  Edit2, 
  LogOut, 
  ShieldCheck, 
  Sun, 
  Moon, 
  Laptop, 
  Users,
  Layers,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  onOpenAddModal: () => void;
  onOpenNotionModal: () => void;
  onOpenImportExportModal: () => void;
  onOpen2FaModal: () => void;
  onOpenCreateCollectionModal: () => void;
  onOpenRenameCollectionModal: (collId: string, currentName: string) => void;
}

export function Sidebar({
  onOpenAddModal,
  onOpenNotionModal,
  onOpenImportExportModal,
  onOpen2FaModal,
  onOpenCreateCollectionModal,
  onOpenRenameCollectionModal
}: SidebarProps) {
  const { 
    items, 
    collections, 
    activeCategory, 
    activeCollectionId, 
    activeView, 
    setActiveCategory, 
    setActiveCollectionId, 
    setActiveView,
    deleteCollection
  } = useItems();

  const { user, signOut, signInWithDemoUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const [activeMenuCollId, setActiveMenuCollId] = useState<string | null>(null);

  const categories: { id: CategoryType; label: string; icon: React.ReactNode }[] = [
    { id: 'photos', label: 'Fotos', icon: <Image size={18} /> },
    { id: 'videos', label: 'Videos', icon: <Video size={18} /> },
    { id: 'music', label: 'Música', icon: <Music size={18} /> },
    { id: 'documents', label: 'Documentos', icon: <FileText size={18} /> },
    { id: 'others', label: 'Otros', icon: <Archive size={18} /> },
  ];

  // Counts
  const totalActive = items.filter(i => !i.isTrash).length;
  const totalFavorites = items.filter(i => !i.isTrash && i.isFavorite).length;
  const totalTrash = items.filter(i => i.isTrash).length;

  return (
    <aside className="w-64 h-screen bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 select-none hidden md:flex">
      {/* Top Part */}
      <div className="p-4 flex-1 overflow-y-auto">
        {/* Brand */}
        <div className="flex items-center justify-between mb-6 px-2">
          <Logo size={32} />
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onOpenAddModal}
          className="w-full mb-6 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition-all"
        >
          <Plus size={18} />
          <span>Añadir archivo</span>
        </button>

        {/* Main Views */}
        <div className="space-y-1 mb-6">
          <button
            onClick={() => {
              setActiveView('library');
              setActiveCategory('all');
              setActiveCollectionId(null);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeView === 'library' && activeCategory === 'all' && activeCollectionId === null
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Layers size={18} />
              <span>Todos los archivos</span>
            </div>
            <span className="text-xs text-slate-400 font-mono">{totalActive}</span>
          </button>

          <button
            onClick={() => {
              setActiveView('favorites');
              setActiveCollectionId(null);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeView === 'favorites'
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Star size={18} />
              <span>Favoritos</span>
            </div>
            <span className="text-xs text-slate-400 font-mono">{totalFavorites}</span>
          </button>

          <button
            onClick={() => {
              setActiveView('trash');
              setActiveCollectionId(null);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeView === 'trash'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Trash2 size={18} />
              <span>Papelera</span>
            </div>
            <span className="text-xs text-slate-400 font-mono">{totalTrash}</span>
          </button>
        </div>

        {/* Categories Section */}
        <div className="mb-6">
          <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Categorías
          </div>
          <div className="space-y-1">
            {categories.map(cat => {
              const count = items.filter(i => !i.isTrash && i.category === cat.id).length;
              const isSelected = activeView === 'library' && activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveView('library');
                    setActiveCategory(cat.id);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {cat.icon}
                    <span>{cat.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Collections Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Colecciones
            </span>
            <button
              onClick={onOpenCreateCollectionModal}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Nueva colección"
            >
              <Plus size={15} />
            </button>
          </div>

          <div className="space-y-1">
            {collections.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Sin colecciones creadas
              </div>
            ) : (
              collections.map(coll => {
                const count = items.filter(i => !i.isTrash && i.collectionId === coll.id).length;
                const isSelected = activeCollectionId === coll.id;
                return (
                  <div
                    key={coll.id}
                    className="relative group flex items-center justify-between rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    <button
                      onClick={() => {
                        setActiveView('library');
                        setActiveCategory('all');
                        setActiveCollectionId(coll.id);
                      }}
                      className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate max-w-[130px]">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: coll.color || '#8b5cf6' }}
                        />
                        <span className="truncate">{coll.name}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">{count}</span>
                    </button>

                    {/* Collection Options Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenuCollId(activeMenuCollId === coll.id ? null : coll.id)}
                        className="p-1.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-md mr-1 transition-opacity"
                        title="Opciones de colección"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {activeMenuCollId === coll.id && (
                        <div className="absolute right-0 top-8 z-30 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 text-xs animate-in fade-in duration-150">
                          <button
                            onClick={() => {
                              setActiveMenuCollId(null);
                              onOpenRenameCollectionModal(coll.id, coll.name);
                            }}
                            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                          >
                            <Edit2 size={13} /> Renombrar
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenuCollId(null);
                              deleteCollection(coll.id);
                            }}
                            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600"
                          >
                            <Trash2 size={13} /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Profile & Integrations Part */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-2">
        {/* Integrations & Tools Links */}
        <div className="grid grid-cols-2 gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={onOpenNotionModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Sparkles size={14} className="text-cyan-500" />
            <span>Notion</span>
          </button>

          <button
            onClick={onOpenImportExportModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <FolderPlus size={14} className="text-violet-500" />
            <span>JSON</span>
          </button>
        </div>

        {/* Theme Switcher */}
        <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-500">
          <span>Tema</span>
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            <button
              onClick={() => setTheme('light')}
              className={`p-1 rounded-md transition-colors ${theme === 'light' ? 'bg-white dark:bg-slate-700 text-amber-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Modo claro"
            >
              <Sun size={13} />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-1 rounded-md transition-colors ${theme === 'dark' ? 'bg-white dark:bg-slate-700 text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Modo oscuro"
            >
              <Moon size={13} />
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`p-1 rounded-md transition-colors ${theme === 'system' ? 'bg-white dark:bg-slate-700 text-violet-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Seguir sistema"
            >
              <Laptop size={13} />
            </button>
          </div>
        </div>

        {/* User Account / 2FA / Logout */}
        {user ? (
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-violet-500 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                  {user.photoURL ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={user.photoURL} alt={user.displayName || 'Avatar'} className="w-full h-full object-cover" />
                  ) : (
                    (user.displayName?.[0] || 'U').toUpperCase()
                  )}
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                    {user.displayName}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {user.email || 'Usuario local'}
                  </div>
                </div>
              </div>

              <button
                onClick={signOut}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={15} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={onOpen2FaModal}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  user.twoFactorEnabled
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <ShieldCheck size={13} />
                <span>{user.twoFactorEnabled ? '2FA Activo' : 'Configurar 2FA'}</span>
              </button>

              {/* Demo Account Switcher for Testing Data Separation */}
              <button
                onClick={() => signInWithDemoUser(user.uid === 'demo_user_alpha_1' ? 2 : 1)}
                className="py-1.5 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-medium flex items-center gap-1 transition-colors"
                title="Alternar entre Cuenta 1 y Cuenta 2 para comprobar aislamiento de datos"
              >
                <Users size={12} />
                <span>{user.uid === 'demo_user_alpha_1' ? 'A' : 'B'}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
