'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from './api';
import { clearToken, getToken, setToken, type AuthUser } from './auth';

interface LoginResult {
  ok: true;
}

interface LoginError {
  ok: false;
  status: number;
  message: string;
  bloqueadoHasta?: string;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<LoginResult | LoginError>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<AuthUser>('/auth/me', { skipAuthRedirect: true });
      setUser(me);
    } catch {
      // Token inválido/vencido o usuario ya no existe/está inactivo:
      // limpiar y quedar deslogueado, sin redirigir desde acá (lo hace RouteGuard).
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = useCallback(
    async (username: string, password: string): Promise<LoginResult | LoginError> => {
      try {
        const res = await api.post<{ access_token: string; user: AuthUser }>(
          '/auth/login',
          { username, password },
          { skipAuthRedirect: true },
        );
        setToken(res.access_token);
        setUser(res.user);
        return { ok: true };
      } catch (err) {
        if (err instanceof ApiError) {
          const body = err.body as { bloqueadoHasta?: string } | null;
          return {
            ok: false,
            status: err.status,
            message: err.message,
            bloqueadoHasta: body?.bloqueadoHasta,
          };
        }
        return { ok: false, status: 0, message: 'Error de red' };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    // D2 mitigación #4: borrar el token ANTES de llamar al backend. Si el
    // logout remoto falla por red, la sesión local ya quedó cerrada.
    clearToken();
    setUser(null);
    try {
      await api.post('/auth/logout', undefined, { skipAuthRedirect: true });
    } catch {
      // No es crítico: el token ya no existe localmente.
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}
