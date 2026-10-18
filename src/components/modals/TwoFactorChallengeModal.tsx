'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, Key, AlertCircle } from 'lucide-react';

export function TwoFactorChallengeModal() {
  const { twoFactorRequired, verifyTwoFactorChallenge, signOut } = useAuth();
  const [code, setCode] = useState<string>('');
  const [isBackup, setIsBackup] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!twoFactorRequired) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);

    const success = await verifyTwoFactorChallenge(code.trim(), isBackup);
    if (!success) {
      setError(
        isBackup
          ? 'Código de recuperación inválido o ya utilizado.'
          : 'Código de 6 dígitos incorrecto o expirado.'
      );
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-blue-500/20 to-violet-500/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-4 text-blue-500 shadow-md">
          {isBackup ? <Key size={30} /> : <ShieldCheck size={32} />}
        </div>

        <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-1">
          {isBackup ? 'Código de Recuperación' : 'Verificación en dos pasos'}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
          {isBackup
            ? 'Ingresa uno de tus 8 códigos de recuperación de respaldo (ej. 4A8F-9B2C).'
            : 'Ingresa el código temporal de 6 dígitos de tu aplicación autenticadora.'}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-center gap-1.5">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            required
            autoFocus
            maxLength={isBackup ? 12 : 6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={isBackup ? 'XXXX-XXXX' : '000000'}
            className="w-full text-center tracking-widest text-xl font-mono px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors shadow-inner"
          />

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium text-sm shadow-md transition-all active:scale-[0.98]"
          >
            {loading ? 'Verificando...' : 'Confirmar acceso'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
          <button
            onClick={() => {
              setIsBackup(!isBackup);
              setCode('');
              setError(null);
            }}
            className="text-blue-500 hover:underline"
          >
            {isBackup ? 'Usar app autenticadora' : '¿No tienes tu celular? Usar código de recuperación'}
          </button>

          <button
            onClick={signOut}
            className="text-slate-400 hover:text-rose-500"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
