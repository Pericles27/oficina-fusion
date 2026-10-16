'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CajaProvider } from '@/lib/caja-store';
import { AuthProvider } from '@/lib/auth-context';
import { getTheme, setTheme, startThemeSync } from '@/lib/theme';
import { Toaster } from '@/components/ui';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeCtx {
  theme: 'light' | 'dark';
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [mounted, setMounted] = useState(false);

  // Hidratación sincrónica con el script inline de layout.tsx
  const resolved = getTheme();

  useEffect(() => {
    setMounted(true);
    startThemeSync();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setTheme(mode);
  }, [mode, mounted]);

  const setMode = (m: ThemeMode) => setModeState(m);
  const toggleTheme = () =>
    setModeState((m) => {
      if (m === 'system') return 'light';
      if (m === 'light') return 'dark';
      return 'system';
    });

  return (
    <ThemeContext.Provider value={{ theme: resolved, mode, toggleTheme, setMode }}>
      <AuthProvider>
        <CajaProvider>
          <div className="app-root">
            {children}
            <Toaster />
          </div>
        </CajaProvider>
      </AuthProvider>
    </ThemeContext.Provider>
  );
}
