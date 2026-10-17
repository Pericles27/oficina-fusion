/** Fuente única del tema: runtime y script síncrono usan la misma función. */
const THEME_KEY = 'of-theme';
export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export type ResolvedTheme = Exclude<ThemeMode, 'system'>;
export const THEME_COLORS = { light: '#EFEFF4', dark: '#000000' } as const;

const THEME_CONFIG = { key: THEME_KEY, modes: THEME_MODES, colors: THEME_COLORS };
export interface ThemeSnapshot {
  mode: ThemeMode;
  theme: ResolvedTheme;
}

/**
 * Autocontenida: se serializa para layout y también se ejecuta en runtime.
 * No referenciar símbolos externos: su fuente debe funcionar sin el bundle.
 * No escribe storage; únicamente setTheme persiste una decisión del usuario.
 */
function initializeTheme(config: typeof THEME_CONFIG, selected?: ThemeMode): ThemeSnapshot {
  let mode: ThemeMode = selected ?? 'system';
  let theme: ResolvedTheme = 'light';
  try {
    if (selected === undefined) {
      try {
        const stored = window.localStorage.getItem(config.key);
        if (config.modes.includes(stored as ThemeMode)) mode = stored as ThemeMode;
      } catch { /* Storage denegado: seguir sistema. */ }
    }
    if (mode === 'system') {
      try {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } catch { /* Sin matchMedia: fallback claro. */ }
    } else {
      theme = mode;
    }
    document.documentElement.dataset.theme = theme;
    // Propiedad exclusiva del tema: React no renderiza ni reclama esta meta.
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-of-theme]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.setAttribute('data-of-theme', '');
      meta.content = config.colors[theme];
      document.head.appendChild(meta);
    }
    meta.content = config.colors[theme];
  } catch { /* La inicialización nunca bloquea la página. */ }
  return { mode, theme };
}

export const THEME_INIT_SCRIPT = `(${initializeTheme.toString()})(${JSON.stringify(THEME_CONFIG)});`;

// Mantener la elección en esta sesión aunque el navegador niegue persistencia.
let sessionMode: ThemeMode | undefined;

export function getStoredMode(): ThemeMode {
  if (sessionMode !== undefined) return sessionMode;
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return THEME_MODES.includes(stored as ThemeMode) ? stored as ThemeMode : 'system';
  } catch {
    return 'system';
  }
}

export function hydrateTheme(): ThemeSnapshot {
  return initializeTheme(THEME_CONFIG, getStoredMode());
}

export function resolveTheme(): ResolvedTheme {
  return hydrateTheme().theme;
}

export function getTheme(): ResolvedTheme {
  return resolveTheme();
}

export function setTheme(mode: ThemeMode): ThemeSnapshot {
  sessionMode = mode;
  try {
    window.localStorage.setItem(THEME_KEY, mode);
  } catch { /* La elección de sesión sigue funcionando sin storage. */ }
  return hydrateTheme();
}

/** Suscripción por montaje, sin persistir; devuelve siempre su cleanup. */
export function startThemeSync(onChange: (snapshot: ThemeSnapshot) => void): () => void {
  const update = () => onChange(hydrateTheme());
  const storageHandler = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_KEY) return;
    sessionMode = undefined;
    update();
  };
  const mediaHandler = () => {
    if (getStoredMode() === 'system') update();
  };
  let media: MediaQueryList | undefined;
  try {
    media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', mediaHandler);
  } catch { /* Sin matchMedia: sigue operativo el toggle manual. */ }
  window.addEventListener('storage', storageHandler);
  update();
  return () => {
    window.removeEventListener('storage', storageHandler);
    media?.removeEventListener('change', mediaHandler);
  };
}
