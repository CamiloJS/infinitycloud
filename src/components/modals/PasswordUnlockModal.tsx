'use client';

import React, { useState } from 'react';
import { InfinityItem } from '@/types';
import { verifyItemPassword } from '@/lib/security/itemPassword';
import { Lock, Eye, EyeOff, X, ArrowRight, AlertCircle } from 'lucide-react';

interface PasswordUnlockModalProps {
  item: InfinityItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUnlocked: (item: InfinityItem) => void;
}

export function PasswordUnlockModal({ item, isOpen, onClose, onUnlocked }: PasswordUnlockModalProps) {
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState<boolean>(false);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Por favor ingresa la contraseña.');
      return;
    }

    setChecking(true);
    setError(null);

    try {
      const isValid = await verifyItemPassword(password, item.passwordHash || '');
      if (isValid) {
        setPassword('');
        setError(null);
        onUnlocked(item);
      } else {
        setError('Contraseña incorrecta. Inténtalo nuevamente.');
      }
    } catch {
      setError('Error al verificar la contraseña.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-4 shadow-sm">
          <Lock size={26} />
        </div>

        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Archivo protegido
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 font-medium">
          {item.name}
        </p>

        {error && (
          <div className="mt-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 text-left">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa la contraseña..."
              className="w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-amber-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={checking || !password}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium text-xs shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {checking ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Desbloquear y abrir</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
