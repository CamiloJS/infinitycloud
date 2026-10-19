'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white dark:bg-black p-4 text-slate-900 dark:text-white">
      <div className="max-w-md w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 text-center shadow-xl">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold mb-2">No se pudo cargar la vista</h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-6">
          Ocurrió un error inesperado al renderizar la aplicación. Puedes intentar recargar.
        </p>
        <button
          onClick={() => {
            try {
              window.location.reload();
            } catch {
              reset();
            }
          }}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20"
        >
          <RefreshCw className="w-4 h-4" />
          Recargar Infinity
        </button>
      </div>
    </div>
  );
}
