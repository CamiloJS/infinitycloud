'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function AutoUpdateListener() {
  const currentVersionRef = useRef<string | null>(null);
  const [updating, setUpdating] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;
    let timer: NodeJS.Timeout | null = null;

    const checkVersion = async () => {
      try {
        const res = await fetch(`/api/version?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache' }
        });
        if (!res.ok) return;

        const data = await res.json();
        const serverVer = data?.version;
        if (!serverVer) return;

        if (!currentVersionRef.current) {
          currentVersionRef.current = serverVer;
          return;
        }

        if (serverVer !== currentVersionRef.current) {
          const lastReloaded = sessionStorage.getItem('infinity_reloaded_ver');
          if (lastReloaded === serverVer) {
            currentVersionRef.current = serverVer;
            return;
          }

          if (isMounted) {
            setUpdating(true);
            sessionStorage.setItem('infinity_reloaded_ver', serverVer);
            // Brief timeout for user feedback before soft reload
            setTimeout(() => {
              window.location.reload();
            }, 800);
          }
        }
      } catch {
        // Silently ignore network check failures (offline, etc.)
      }
    };

    // Initial check on mount
    checkVersion();

    // Check periodically every 40 seconds
    timer = setInterval(checkVersion, 40000);

    // Also check whenever tab becomes visible again
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', checkVersion);

    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', checkVersion);
    };
  }, []);

  if (!updating) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-violet-600 text-white shadow-2xl animate-in slide-in-from-top-4 duration-300 text-xs font-semibold">
      <RefreshCw size={14} className="animate-spin" />
      <span>Nueva versión disponible. Actualizando Infinity...</span>
    </div>
  );
}
