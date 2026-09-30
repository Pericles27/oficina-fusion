'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CajaProvider } from '@/lib/caja-store';
import { AuthProvider } from '@/lib/auth-context';
import { getStoredTheme, setStoredTheme } from '@/lib/theme-storage';
import { Toaster } from '@/components/ui';

type Theme = 'light' | 'dark';

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // Hidratación: leer preferencia guardada o la del sistema
  useEffect(() => {
    const stored = getStoredTheme();
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setThemeState(stored ?? (prefersDark ? 'dark' : 'light'));
    setMounted(true);
  }, []);

  // Aplicar al DOM
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.theme = theme;
    setStoredTheme(theme);
  }, [theme, mounted]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
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
