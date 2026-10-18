'use client';

import React, { useState } from 'react';
import { useItems } from '@/context/ItemsContext';
import { X, Download, Upload, Check, AlertCircle, FileCode } from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportExportModal({ isOpen, onClose }: ImportExportModalProps) {
  const { exportDataJson, importDataJson } = useItems();
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [importing, setImporting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      const jsonStr = await exportDataJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `infinity-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Error al exportar datos.' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStatusMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileContent(event.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!fileContent.trim()) return;

    setImporting(true);
    setStatusMsg(null);

    try {
      const result = await importDataJson(fileContent, importMode);
      if (result.success) {
        setStatusMsg({ type: 'success', text: result.message });
        setFileContent('');
        setFileName('');
      } else {
        setStatusMsg({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error al procesar el archivo JSON.' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500">
              <FileCode size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-white">Copia de seguridad (JSON)</h3>
              <p className="text-xs text-slate-400">Exporta o importa tus metadatos y colecciones</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X size={18} />
          </button>
        </div>

        {statusMsg && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
            }`}
          >
            {statusMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="mt-5 space-y-6">
          {/* Export Box */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Exportar biblioteca</h4>
              <p className="text-xs text-slate-400">Descarga un archivo JSON con todos tus enlaces y carpetas.</p>
            </div>
            <button
              onClick={handleExport}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-white flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download size={15} />
              <span>Exportar</span>
            </button>
          </div>

          {/* Import Box */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Importar biblioteca</h4>
              <p className="text-xs text-slate-400">Restaura metadatos desde un archivo JSON validado.</p>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="merge"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="accent-violet-500"
                />
                <span>Combinar con existentes</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="accent-violet-500"
                />
                <span>Reemplazar todo</span>
              </label>
            </div>

            <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center hover:border-violet-500 transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload size={24} className="mx-auto text-slate-400 mb-1" />
              <span className="text-xs text-slate-500">
                {fileName ? fileName : 'Selecciona o arrastra un archivo .json'}
              </span>
            </div>

            {fileContent && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                {importing ? 'Validando e importando...' : 'Iniciar importación'}
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
