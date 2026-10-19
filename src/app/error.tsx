'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Infinity App Error Caught:', error);
  }, [error]);

  const handleGoHome = () => {
    try {
      window.location.href = '/';
    } catch {
      reset();
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white dark:bg-black p-4 text-slate-900 dark:text-white">
      <div className="max-w-md w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 text-center shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold mb-2">No se pudo cargar la vista</h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
          Ocurrió un error inesperado al renderizar la aplicación. Puedes intentar recargar.
        </p>

        {error?.message && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-left text-xs font-mono text-rose-400 max-h-36 overflow-y-auto break-all">
            <p className="font-bold text-rose-300 mb-1">{error.name || 'Error'}:</p>
            <p>{error.message}</p>
            {error.digest && (
              <p className="text-[10px] text-slate-500 mt-2 font-sans">Digest: {error.digest}</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={() => {
              try {
                window.location.reload();
              } catch {
                reset();
              }
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20 active:scale-95 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Recargar Infinity
          </button>

          <button
            onClick={handleGoHome}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-medium rounded-xl transition-colors active:scale-95 text-sm"
          >
            <Home className="w-4 h-4" />
            Volver a la Biblioteca
          </button>
        </div>
      </div>
    </div>
  );
}
