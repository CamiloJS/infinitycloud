'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  X, 
  Settings, 
  ShieldCheck, 
  ShieldAlert, 
  Database, 
  LogOut, 
  Mail, 
  User as UserIcon,
  ChevronRight
} from 'lucide-react';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen2FaModal: () => void;
  onOpenImportExportModal: () => void;
}

export function AccountSettingsModal({
  isOpen,
  onClose,
  onOpen2FaModal,
  onOpenImportExportModal
}: AccountSettingsModalProps) {
  const { user, signOut } = useAuth();

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-white">Ajustes de la cuenta</h3>
              <p className="text-xs text-slate-400">Seguridad, verificación en dos pasos y datos personales</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* User Profile Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-500 to-violet-600 text-white flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden shadow-md">
              {user.photoURL ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={user.photoURL} alt={user.displayName || 'Avatar'} className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={26} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  {user.displayName || 'Usuario'}
                </h4>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Activa
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                <Mail size={12} className="shrink-0" />
                <span className="truncate">{user.email || 'Sin correo asociado'}</span>
              </p>
            </div>
          </div>

          {/* Security & 2FA Section */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${user.twoFactorEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {user.twoFactorEnabled ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                    Verificación en dos pasos (2FA)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {user.twoFactorEnabled 
                      ? 'Tu cuenta está protegida con código autenticador TOTP.' 
                      : 'Aumenta la seguridad de tus archivos activando el segundo factor.'}
                  </p>
                </div>
              </div>

              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${
                user.twoFactorEnabled 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}>
                {user.twoFactorEnabled ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpen2FaModal();
              }}
              className="w-full mt-2 py-2 px-3.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-blue-500" />
                <span>{user.twoFactorEnabled ? 'Gestionar o desactivar 2FA' : 'Configurar 2FA ahora'}</span>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </button>
          </div>

          {/* Backup & Data Section */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500">
                <Database size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                  Copia de seguridad y metadatos
                </h4>
                <p className="text-[11px] text-slate-400">
                  Exporta o importa tus enlaces y colecciones en formato JSON estandarizado.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenImportExportModal();
              }}
              className="w-full mt-1 py-2 px-3.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between transition-colors shadow-sm"
            >
              <span>Gestionar copia de seguridad (JSON)</span>
              <ChevronRight size={14} className="text-slate-400" />
            </button>
          </div>

          {/* Logout Action */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                signOut();
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut size={16} />
              <span>Cerrar sesión en Infinity</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
