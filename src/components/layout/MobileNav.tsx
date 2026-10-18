'use client';

import React from 'react';
import { useItems } from '@/context/ItemsContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Logo } from '@/components/ui/Logo';
import { CategoryType } from '@/types';
import { 
  X, 
  Layers, 
  Star, 
  Trash2, 
  Image, 
  Video, 
  Music, 
  FileText, 
  Archive, 
  Plus, 
  Sparkles, 
  FolderPlus, 
  ShieldCheck, 
  LogOut,
  Sun,
  Moon,
  Laptop
} from 'lucide-react';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddModal: () => void;
  onOpenNotionModal: () => void;
  onOpenImportExportModal: () => void;
  onOpen2FaModal: () => void;
  onOpenCreateCollectionModal: () => void;
}

export function MobileNav({
  isOpen,
  onClose,
  onOpenAddModal,
  onOpenNotionModal,
  onOpenImportExportModal,
  onOpen2FaModal,
  onOpenCreateCollectionModal
}: MobileNavProps) {
  const { 
    collections, 
    activeCategory, 
    activeCollectionId, 
    activeView, 
    setActiveCategory, 
    setActiveCollectionId, 
    setActiveView 
  } = useItems();

  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  if (!isOpen) return null;

  const categories: { id: CategoryType; label: string; icon: React.ReactNode }[] = [
    { id: 'photos', label: 'Fotos', icon: <Image size={18} /> },
    { id: 'videos', label: 'Videos', icon: <Video size={18} /> },
    { id: 'music', label: 'Música', icon: <Music size={18} /> },
    { id: 'documents', label: 'Documentos', icon: <FileText size={18} /> },
    { id: 'others', label: 'Otros', icon: <Archive size={18} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose} 
      />

      {/* Drawer */}
      <div className="relative w-4/5 max-w-xs h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-4 z-10 shadow-2xl overflow-y-auto">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <Logo size={28} />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Add */}
          <button
            onClick={() => {
              onClose();
              onOpenAddModal();
            }}
            className="w-full mt-4 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md"
          >
            <Plus size={18} />
            <span>Añadir enlace</span>
          </button>

          {/* Main Views */}
          <div className="space-y-1 mt-4">
            <button
              onClick={() => {
                setActiveView('library');
                setActiveCategory('all');
                setActiveCollectionId(null);
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium ${
                activeView === 'library' && activeCategory === 'all' && activeCollectionId === null
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Layers size={18} />
              <span>Todos los archivos</span>
            </button>

            <button
              onClick={() => {
                setActiveView('favorites');
                setActiveCollectionId(null);
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium ${
                activeView === 'favorites'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Star size={18} />
              <span>Favoritos</span>
            </button>

            <button
              onClick={() => {
                setActiveView('trash');
                setActiveCollectionId(null);
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium ${
                activeView === 'trash'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Trash2 size={18} />
              <span>Papelera</span>
            </button>
          </div>

          {/* Categories */}
          <div className="mt-6">
            <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Categorías
            </div>
            <div className="space-y-1">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveView('library');
                    setActiveCategory(cat.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium ${
                    activeView === 'library' && activeCategory === cat.id
                      ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Collections */}
          <div className="mt-6">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Colecciones
              </span>
              <button
                onClick={() => {
                  onClose();
                  onOpenCreateCollectionModal();
                }}
                className="p-1 rounded text-slate-400"
              >
                <Plus size={15} />
              </button>
            </div>
            <div className="space-y-1">
              {collections.map(coll => (
                <button
                  key={coll.id}
                  onClick={() => {
                    setActiveView('library');
                    setActiveCategory('all');
                    setActiveCollectionId(coll.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium ${
                    activeCollectionId === coll.id
                      ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: coll.color || '#8b5cf6' }}
                  />
                  <span className="truncate">{coll.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Options */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenNotionModal();
              }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <Sparkles size={14} className="text-cyan-500" /> Notion
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenImportExportModal();
              }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <FolderPlus size={14} className="text-violet-500" /> JSON
            </button>
          </div>

          {/* Theme */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tema</span>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              <button
                onClick={() => setTheme('light')}
                className={`p-1 rounded ${theme === 'light' ? 'bg-white text-amber-500' : 'text-slate-400'}`}
              >
                <Sun size={14} />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1 rounded ${theme === 'dark' ? 'bg-slate-700 text-blue-400' : 'text-slate-400'}`}
              >
                <Moon size={14} />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`p-1 rounded ${theme === 'system' ? 'bg-slate-700 text-violet-400' : 'text-slate-400'}`}
              >
                <Laptop size={14} />
              </button>
            </div>
          </div>

          {/* User & 2FA */}
          {user && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  onClose();
                  onOpen2FaModal();
                }}
                className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"
              >
                <ShieldCheck size={14} className="text-emerald-500" /> 2FA
              </button>
              <button
                onClick={signOut}
                className="p-1.5 text-slate-400 hover:text-rose-500"
                title="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
