'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Lock, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button, Input } from '@/components/ui';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ya autenticado: no tiene sentido ver el login. Redirige según su rol real
  // (F2: el selector de rol de la home desaparece, ver app/page.tsx).
  useEffect(() => {
    if (loading || !user) return;
    if (user.primerLogin) {
      router.replace('/cambiar-password');
      return;
    }
    const soloCadete = user.roles.length > 0 && user.roles.every((r) => r === 'CADETE');
    router.replace(soloCadete ? '/cadete' : '/admin');
  }, [loading, user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await login(username, password);

    setSubmitting(false);

    if (!result.ok) {
      if (result.status === 403 && result.bloqueadoHasta) {
        const fecha = new Date(result.bloqueadoHasta).toLocaleString('es-AR');
        setError(`Cuenta bloqueada por intentos fallidos hasta ${fecha}.`);
      } else if (result.status === 401) {
        setError('Usuario o contraseña incorrectos.');
      } else {
        setError(result.message || 'No se pudo iniciar sesión.');
      }
      return;
    }

    // El AuthProvider ya actualizó `user`; el useEffect de arriba redirige.
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
            <Building2 className="w-8 h-8" />
          </span>
          <h1 className="display-sm">Oficina Fusion</h1>
          <p className="body-1 max-w-[42ch]" style={{ color: 'var(--warm-gray-2)' }}>
            Iniciá sesión para continuar
          </p>
        </header>

        <form className="card p-5 sm:p-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Usuario"
            name="username"
            autoComplete="username"
            prefixIcon={<UserIcon className="w-4 h-4" />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="current-password"
            prefixIcon={<Lock className="w-4 h-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="text-small" style={{ color: 'var(--danger)' }} role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" fullWidth loading={submitting}>
            Ingresar
          </Button>
        </form>
      </div>
    </main>
  );
}
