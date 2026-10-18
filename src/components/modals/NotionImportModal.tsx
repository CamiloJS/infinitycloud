'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useItems } from '@/context/ItemsContext';
import { saveItem } from '@/lib/firebase/firestore';
import { 
  X, 
  Sparkles, 
  Key, 
  Search, 
  Database, 
  FileText, 
  Download, 
  CheckCircle2, 
  RefreshCw, 
  ShieldAlert
} from 'lucide-react';

interface NotionImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotionImportModal({ isOpen, onClose }: NotionImportModalProps) {
  const { user, refreshProfile } = useAuth();
  const { collections, refreshData } = useItems();

  const [step, setStep] = useState<'connect' | 'browse' | 'importing' | 'summary'>('connect');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [connecting, setConnecting] = useState<boolean>(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Search & browse
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [selectedTarget, setSelectedTarget] = useState<{ id: string; type: 'page' | 'database'; title: string } | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');

  // Import status
  const [importing, setImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<{ totalDiscovered: number; newItemsCount: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (user?.notionConnected) {
        setStep('browse');
        handleSearch();
      } else {
        setStep('connect');
      }
      setConnectError(null);
      setImportError(null);
      setImportResult(null);
    }
  }, [isOpen, user?.notionConnected]);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim() || !user) return;

    setConnecting(true);
    setConnectError(null);

    try {
      const res = await fetch('/api/notion/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          token: tokenInput.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al conectar con Notion');
      }

      await refreshProfile();
      setStep('browse');
      handleSearch();
    } catch (err: any) {
      setConnectError(err.message || 'Error de conexión');
    } finally {
      setConnecting(false);
    }
  };

  const handleSearch = async () => {
    if (!user) return;
    setSearching(true);
    try {
      const res = await fetch('/api/notion/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          query: searchQuery
        })
      });

      const data = await res.json();
      if (res.ok && data.results) {
        setSearchResults(data.results);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleStartImport = async () => {
    if (!selectedTarget || !user) return;
    setImporting(true);
    setImportError(null);
    setStep('importing');

    try {
      const res = await fetch('/api/notion/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          targetId: selectedTarget.id,
          targetType: selectedTarget.type,
          collectionId: selectedCollectionId || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error durante la importación');
      }

      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          try {
            await saveItem(user.uid, item);
          } catch (saveErr) {
            console.warn('Item save error in modal:', saveErr);
          }
        }
      }

      setImportResult({
        totalDiscovered: data.totalDiscovered,
        newItemsCount: data.newItemsCount
      });
      setStep('summary');
      await refreshData();
    } catch (err: any) {
      setImportError(err.message || 'Fallo durante la importación');
      setStep('browse');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-white">Integración con Notion</h3>
              <p className="text-xs text-slate-400">Importa imágenes, videos, audio y documentos desde tus páginas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Step 1: Connect Token */}
        {step === 'connect' && (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2 leading-relaxed text-slate-600 dark:text-slate-300">
              <div className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                <Key size={14} className="text-blue-500" />
                <span>¿Cómo conectar tu cuenta de Notion de forma segura?</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 pl-1">
                <li>Ve a <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">notion.so/my-integrations</a> y crea una integración (ej. &ldquo;Infinity&rdquo;).</li>
                <li>Copia el <strong>Internal Integration Secret</strong> (comienza con <code>ntn_...</code> o <code>secret_...</code>).</li>
                <li>En Notion, ve a las páginas o bases de datos que quieras importar, pulsa los tres puntos (<strong>&hellip;</strong>) &gt; <strong>Conexiones</strong> &gt; Agrega tu integración &ldquo;Infinity&rdquo;.</li>
              </ol>
              <div className="text-[11px] text-amber-500 dark:text-amber-400 pt-1 flex items-center gap-1">
                <ShieldAlert size={13} className="shrink-0" />
                Tu clave se almacena cifrada en el servidor (AES-256) y nunca se expone al navegador.
              </div>
            </div>

            {connectError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                {connectError}
              </div>
            )}

            <form onSubmit={handleConnect} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Internal Integration Secret
                </label>
                <input
                  type="password"
                  required
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="secret_... o ntn_..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono text-slate-800 dark:text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={connecting || !tokenInput.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-medium text-xs shadow-md flex items-center gap-2"
                >
                  {connecting ? 'Verificando con Notion...' : 'Conectar integración'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Browse & Select Page/DB */}
        {step === 'browse' && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                Conectado a Notion ({user?.notionWorkspaceName || 'Integración'})
              </span>
              <button
                onClick={() => setStep('connect')}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
              >
                Cambiar token
              </button>
            </div>

            {importError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                {importError}
              </div>
            )}

            {/* Search Bar for Notion Pages */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Buscar páginas o bases de datos compartidas..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-cyan-500"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {searching ? <RefreshCw size={14} className="animate-spin" /> : 'Buscar'}
              </button>
            </div>

            {/* Accessible Resources List */}
            <div className="max-h-52 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-950/50">
              {searchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  {searching ? 'Buscando en Notion...' : 'No se encontraron páginas compartidas con la integración. Recuerda compartir tu página con la integración en Notion usando los 3 puntos (...) > Conexiones.'}
                </div>
              ) : (
                searchResults.map(item => {
                  const isSelected = selectedTarget?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedTarget({ id: item.id, type: item.type, title: item.title })}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-all ${
                        isSelected
                          ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-500 text-cyan-800 dark:text-cyan-200'
                          : 'border-slate-200/80 dark:border-slate-800/80 hover:bg-white dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate max-w-sm">
                        {item.type === 'database' ? (
                          <Database size={16} className="text-blue-500 shrink-0" />
                        ) : (
                          <FileText size={16} className="text-cyan-500 shrink-0" />
                        )}
                        <span className="font-medium truncate">{item.title}</span>
                      </div>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500">
                        {item.type}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Destination Collection Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Guardar en colección (Opcional)
              </label>
              <select
                value={selectedCollectionId}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none"
              >
                <option value="">Sin colección</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cerrar
              </button>
              <button
                onClick={handleStartImport}
                disabled={!selectedTarget || importing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-medium text-xs shadow-md flex items-center gap-2"
              >
                <Download size={15} />
                <span>Escanear e importar archivos</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Importing Spinner */}
        {step === 'importing' && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-white text-base">Escaneando contenido de Notion</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Recuperando imágenes, audio, videos y documentos adjuntos de &ldquo;{selectedTarget?.title}&rdquo;.
                Respetando límites de velocidad y evitando duplicados...
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === 'summary' && importResult && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-white text-lg">Importación completada</h4>
              <p className="text-xs text-slate-500 mt-1">
                Se detectaron {importResult.totalDiscovered} archivos en la página.
              </p>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
                +{importResult.newItemsCount} archivos nuevos añadidos a tu biblioteca Infinity
              </p>
              {importResult.totalDiscovered > importResult.newItemsCount && (
                <p className="text-[11px] text-slate-400 mt-1">
                  ({importResult.totalDiscovered - importResult.newItemsCount} archivos ya existían previamente y se omitieron para evitar duplicados).
                </p>
              )}
            </div>

            <button
              onClick={onClose}
              className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-medium text-xs shadow-md"
            >
              Ver en la biblioteca
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
