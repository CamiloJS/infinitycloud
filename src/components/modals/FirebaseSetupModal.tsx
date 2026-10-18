'use client';

import React, { useState } from 'react';
import { saveFirebaseConfig, FirebaseClientConfig } from '@/lib/firebase/client';
import { X, Flame, Check, AlertCircle, Copy } from 'lucide-react';

interface FirebaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FirebaseSetupModal({ isOpen, onClose }: FirebaseSetupModalProps) {
  const [snippet, setSnippet] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParseAndSave = () => {
    setError(null);
    if (!snippet.trim()) {
      setError('Por favor pega el bloque de configuración o JSON de Firebase.');
      return;
    }

    try {
      let config: Partial<FirebaseClientConfig> = {};

      // If it's valid JSON
      if (snippet.trim().startsWith('{') && snippet.trim().endsWith('}')) {
        config = JSON.parse(snippet.trim());
      } else {
        // Extract fields using Regex for JS object format
        const apiKeyMatch = snippet.match(/apiKey:\s*["']([^"']+)["']/);
        const authDomainMatch = snippet.match(/authDomain:\s*["']([^"']+)["']/);
        const projectIdMatch = snippet.match(/projectId:\s*["']([^"']+)["']/);
        const storageBucketMatch = snippet.match(/storageBucket:\s*["']([^"']+)["']/);
        const messagingSenderIdMatch = snippet.match(/messagingSenderId:\s*["']([^"']+)["']/);
        const appIdMatch = snippet.match(/appId:\s*["']([^"']+)["']/);

        if (apiKeyMatch) config.apiKey = apiKeyMatch[1];
        if (authDomainMatch) config.authDomain = authDomainMatch[1];
        if (projectIdMatch) config.projectId = projectIdMatch[1];
        if (storageBucketMatch) config.storageBucket = storageBucketMatch[1];
        if (messagingSenderIdMatch) config.messagingSenderId = messagingSenderIdMatch[1];
        if (appIdMatch) config.appId = appIdMatch[1];
      }

      if (!config.apiKey || !config.projectId) {
        throw new Error('No se detectó un apiKey o projectId válido en el texto pegado.');
      }

      saveFirebaseConfig({
        apiKey: config.apiKey,
        authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId || ''
      });
    } catch (err: any) {
      setError(err.message || 'Error al procesar la configuración de Firebase.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <Flame size={22} />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-800 dark:text-white">
              Conectar Google Firebase
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Necesario para el inicio de sesión real con Google.
            </p>
          </div>
        </div>

        <div className="my-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5">
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            ¿Cómo obtenerlo en 30 segundos?
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Entra a <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">console.firebase.google.com</a> y crea o abre tu proyecto.</li>
            <li>En <strong>Authentication</strong> activa el proveedor <strong>Google</strong>.</li>
            <li>En la tuerca de <strong>Configuración del proyecto</strong> &gt; <strong>Tus apps</strong>, pulsa <strong>&lt;/&gt; Web</strong> y copia el bloque <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">firebaseConfig</code>.</li>
          </ol>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Pega aquí tu bloque de configuración:
          </label>
          <textarea
            rows={6}
            value={snippet}
            onChange={(e) => setSnippet(e.target.value)}
            placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "tu-proyecto.firebaseapp.com",\n  projectId: "tu-proyecto",\n  appId: "..."\n};`}
            className="w-full p-3 font-mono text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white outline-none focus:border-amber-500 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleParseAndSave}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-semibold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
          >
            <Check size={15} />
            <span>Guardar y Activar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
