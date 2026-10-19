'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen w-full flex items-center justify-center bg-black text-white p-4 font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h2 className="text-xl font-bold mb-2">Error crítico del sistema</h2>
          <p className="text-sm text-zinc-400 mb-6">
            No se pudo iniciar la interfaz de Infinity. Pulsa abajo para reiniciar la aplicación.
          </p>
          <button
            onClick={() => {
              try {
                window.location.href = '/';
              } catch {
                reset();
              }
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
          >
            Reiniciar Infinity
          </button>
        </div>
      </body>
    </html>
  );
}
