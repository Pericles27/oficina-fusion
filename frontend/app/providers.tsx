'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CajaProvider } from '@/lib/caja-store';
import { AuthProvider } from '@/lib/auth-context';
import { setTheme, startThemeSync, type ThemeMode, type ThemeSnapshot } from '@/lib/theme';
import { Toaster } from '@/components/ui';

export type { ThemeMode } from '@/lib/theme';

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
  // Snapshot SSR estable: leer la preferencia al montar sin escribir storage.
  // El script síncrono ya aplicó el tema antes de que React hidrate.
  const [snapshot, setSnapshot] = useState<ThemeSnapshot>({ mode: 'system', theme: 'light' });
  useEffect(() => startThemeSync(setSnapshot), []);

  const setMode = (mode: ThemeMode) => setSnapshot(setTheme(mode));
  const toggleTheme = () => setMode(
    snapshot.mode === 'system' ? 'light' : snapshot.mode === 'light' ? 'dark' : 'system'
  );

  const content = (
    <div className="app-root">
      {children}
      <Toaster />
    </div>
  );

  return (
    <ThemeContext.Provider value={{ ...snapshot, toggleTheme, setMode }}>
      <AuthProvider>
        <CajaProvider>
          {content}
        </CajaProvider>
      </AuthProvider>
    </ThemeContext.Provider>
  );
}
