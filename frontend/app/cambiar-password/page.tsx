'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { Button, Input } from '@/components/ui';

/**
 * D4 / Fase 4: toda cuenta nueva (o reseteada por un admin) nace con
 * `primerLogin=true`. El usuario está obligado a pasar por acá antes de
 * usar el resto del sistema — RouteGuard redirige acá mientras el flag
 * siga en true.
 */
export default function CambiarPasswordPage() {
  const { user, loading, logout, refreshMe } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!user.primerLogin) {
      router.replace(user.roles.every((r) => r === 'CADETE') ? '/cadete' : '/admin');
    }
  }, [loading, user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (newPassword.length < 6) {
      setError('La contraseña nueva debe tener al menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      await refreshMe();
      // refreshMe actualiza primerLogin=false; el useEffect de arriba redirige.
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('La contraseña actual es incorrecta.');
      } else {
        setError('No se pudo cambiar la contraseña. Intentá de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="min-h-dvh grid place-items-center px-4 py-10"
      style={{ paddingTop: 'calc(40px + env(safe-area-inset-top))' }}
    >
      <div className="w-full max-w-[420px] flex flex-col gap-7 animate-in">
        <header className="flex flex-col items-center text-center gap-3">
          <span
            className="grid place-items-center w-[68px] h-[68px] text-white"
            style={{
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(180deg, var(--blue-hover), var(--blue))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4), 0 14px 38px var(--blue-glow)',
            }}
          >
            <KeyRound className="w-8 h-8" />
          </span>
          <h1 className="display-sm">Cambiá tu contraseña</h1>
          <p className="body-1 max-w-[42ch]" style={{ color: 'var(--warm-gray-2)' }}>
            Es tu primer ingreso. Elegí una contraseña propia antes de continuar.
          </p>
        </header>

        <form className="card p-5 sm:p-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Contraseña nueva"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
          <Input
            label="Confirmar contraseña nueva"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />

          {error && (
            <p className="text-small" style={{ color: 'var(--danger)' }} role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" fullWidth loading={submitting}>
            Guardar y continuar
          </Button>
          <Button type="button" variant="ghost" fullWidth onClick={() => logout().then(() => router.replace('/login'))}>
            Cerrar sesión
          </Button>
        </form>
      </div>
    </main>
  );
}
