'use client';

import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ViewerErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ViewerErrorBoundary caught rendering error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white mb-1">
                {this.props.title || 'No se pudo reproducir este contenido'}
              </h3>
              <p className="text-xs text-slate-400">
                Ocurrió un problema temporal al cargar el visor. Tus archivos de la biblioteca siguen intactos.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] font-mono text-rose-300 text-left max-h-24 overflow-y-auto break-all">
                {this.state.error.name}: {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.resetError}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-95"
              >
                <RefreshCw size={14} />
                <span>Reintentar</span>
              </button>
              <button
                type="button"
                onClick={this.props.onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95"
              >
                <X size={14} />
                <span>Cerrar visor</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
