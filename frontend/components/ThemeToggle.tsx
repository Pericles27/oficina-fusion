'use client';

import { useTheme, type ThemeMode } from '@/app/providers';
import { Moon, Sun, Monitor } from 'lucide-react';

/**
 * Botón de alternar tema con 3 estados:
 *   ☀️ light  →  🌙 dark  →  🖥️ system  →  ☀️ light
 */
export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  const nextMode = (): ThemeMode => {
    if (mode === 'system') return 'light';
    if (mode === 'light') return 'dark';
    return 'system';
  };

  const label =
    mode === 'light'
      ? 'Modo claro'
      : mode === 'dark'
        ? 'Modo oscuro'
        : 'Sistema';

  const icon =
    mode === 'light'
      ? <Sun className="w-4 h-4" />
      : mode === 'dark'
        ? <Moon className="w-4 h-4" />
        : <Monitor className="w-4 h-4" />;

  return (
    <button
      className="btn btn-icon"
      onClick={() => setMode(nextMode())}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
