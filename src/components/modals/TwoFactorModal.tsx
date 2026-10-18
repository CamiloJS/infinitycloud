'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  X, 
  ShieldCheck, 
  Copy, 
  Check, 
  AlertTriangle 
} from 'lucide-react';

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TwoFactorModal({ isOpen, onClose }: TwoFactorModalProps) {
  const { user, refreshProfile } = useAuth();

  const [step, setStep] = useState<'status' | 'setup' | 'confirm' | 'disable'>('status');
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
    hashedBackupCodes: string[];
  } | null>(null);

  const [verifyCode, setVerifyCode] = useState<string>('');
  const [disableCode, setDisableCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCodes, setCopiedCodes] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleStartSetup = async () => {
    if (!user?.email) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar 2FA');

      setSetupData(data);
      setStep('setup');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData || !user) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          secret: setupData.secret,
          token: verifyCode.trim(),
          hashedBackupCodes: setupData.hashedBackupCodes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto');

      await refreshProfile();
      setStep('status');
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          code: disableCode.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto');

      await refreshProfile();
      setStep('status');
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    if (setupData?.backupCodes) {
      navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-white">
                Verificación en dos pasos (2FA)
              </h3>
              <p className="text-xs text-slate-400">Protege tu cuenta con Google Authenticator o apps TOTP</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* State: Status */}
        {step === 'status' && (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Estado</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${user?.twoFactorEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  <span className="font-bold text-sm text-slate-800 dark:text-white">
                    {user?.twoFactorEnabled ? '2FA Activado y protegido' : '2FA Desactivado'}
                  </span>
                </div>
              </div>

              {user?.twoFactorEnabled ? (
                <button
                  onClick={() => setStep('disable')}
                  className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold"
                >
                  Desactivar
                </button>
              ) : (
                <button
                  onClick={handleStartSetup}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md"
                >
                  {loading ? 'Generando...' : 'Activar ahora'}
                </button>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              La verificación en dos pasos solicita un código de 6 dígitos generado por tu celular al iniciar sesión o acceder a datos sensibles, protegiendo tus archivos contra accesos no autorizados.
            </p>
          </div>
        )}

        {/* State: Setup (QR + Codes) */}
        {step === 'setup' && setupData && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setupData.qrCodeUrl}
                alt="Código QR 2FA"
                className="w-32 h-32 rounded-lg bg-white p-1 border shadow-sm shrink-0"
              />
              <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-white">1. Escanea el código QR</p>
                <p>Usa Google Authenticator, 1Password o tu aplicación TOTP favorita.</p>
                <p className="text-[11px] text-slate-400 font-mono select-all pt-1">
                  Clave secreta manual: <strong className="text-slate-700 dark:text-slate-200">{setupData.secret}</strong>
                </p>
              </div>
            </div>

            {/* Backup recovery codes */}
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-2">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 font-semibold">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle size={15} /> Códigos de recuperación de un solo uso
                </span>
                <button
                  onClick={copyBackupCodes}
                  className="flex items-center gap-1 text-[11px] underline"
                >
                  {copiedCodes ? <Check size={13} /> : <Copy size={13} />}
                  {copiedCodes ? 'Copiados' : 'Copiar todos'}
                </button>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Guarda estos 8 códigos en un lugar seguro. Te permitirán recuperar el acceso si pierdes tu celular.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[11px] text-center pt-1">
                {setupData.backupCodes.map((c, i) => (
                  <span key={i} className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <form onSubmit={handleConfirmActivation} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  2. Ingresa el código de 6 dígitos generado por tu app
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="000000"
                  className="w-full text-center tracking-widest text-lg font-mono px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('status')}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={loading || verifyCode.length < 6}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs shadow-md"
                >
                  {loading ? 'Verificando...' : 'Confirmar y activar 2FA'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* State: Disable 2FA */}
        {step === 'disable' && (
          <form onSubmit={handleDisable} className="mt-4 space-y-4">
            <p className="text-xs text-slate-500">
              Para desactivar la verificación en dos pasos, confirma con el código actual de 6 dígitos de tu app autenticadora.
            </p>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Código de autenticación
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder="000000"
                className="w-full text-center tracking-widest text-lg font-mono px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('status')}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || disableCode.length < 6}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-medium text-xs shadow-md"
              >
                {loading ? 'Verificando...' : 'Desactivar 2FA'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
