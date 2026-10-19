import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { ItemsProvider } from '@/context/ItemsContext';
import { PlayerProvider } from '@/context/PlayerContext';
import { BottomPlayer } from '@/components/layout/BottomPlayer';

export const metadata: Metadata = {
  title: 'Infinity — Repositorio Personal Multi-Plataforma',
  description: 'Organiza y reproduce archivos de Notion, YouTube, Google Drive y enlaces directos en una única interfaz moderna.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let theme = null;
                try {
                  if (typeof window !== 'undefined' && window.localStorage) {
                    theme = window.localStorage.getItem('infinity_theme');
                  }
                } catch (err) {}
                const isDark = theme === 'dark' || (!theme && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch (e) {}
              try {
                if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    for (var i = 0; i < regs.length; i++) {
                      regs[i].unregister();
                    }
                  });
                }
              } catch (swErr) {}
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-white text-slate-900 dark:bg-black dark:text-slate-100 selection:bg-blue-500 selection:text-white">
        <ThemeProvider>
          <AuthProvider>
            <ItemsProvider>
              <PlayerProvider>
                {children}
                <BottomPlayer />
              </PlayerProvider>
            </ItemsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
