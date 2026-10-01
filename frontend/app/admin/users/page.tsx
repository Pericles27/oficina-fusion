'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Plus, Search, ShieldCheck, UserCog, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * FASE 4 — Gestión de usuarios (sólo ADMIN).
 *
 * Toda la autorización real vive en el backend (`@Roles(ADMIN)` en
 * `UsersController`). Esta pantalla no "protege" nada: si un no-admin llegara
 * acá, cada request volvería 403. El guard de ruta es UX, no seguridad.
 */

type Rol = 'ADMIN' | 'OPERADOR' | 'CADETE';

interface Usuario {
  id: string;
  username: string;
  nombre: string;
  email: string | null;
  roles: Rol[];
  activo: boolean;
  bloqueado: boolean;
  primerLogin: boolean;
  creadoEn: string;
}

const ROLES: Rol[] = ['ADMIN', 'OPERADOR', 'CADETE'];

const rolBadge: Record<Rol, string> = {
  ADMIN: 'badge-danger',
  OPERADOR: 'badge-warning',
  CADETE: 'badge-success',
};

const rolDescripcion: Record<Rol, string> = {
  ADMIN: 'Acceso total. Confirma y reabre el cierre diario, gestiona usuarios.',
  OPERADOR: 'Carga operaciones y arma el cierre, pero NO puede confirmarlo.',
  CADETE: 'Sólo e-tickets asignados. Sin acceso a operaciones ni al cierre.',
};

export default function UsersPage() {
  const { user: yo } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState<string | null>(null);

  // Password temporal devuelta por el backend tras un reset. Se muestra UNA vez
  // y no se persiste en ningún lado: si el admin la pierde, resetea de nuevo.
  const [passTemporal, setPassTemporal] = useState<{ nombre: string; pass: string } | null>(null);
  const [nuevo, setNuevo] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setUsuarios(await api.get<Usuario[]>('/users'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pude cargar los usuarios');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nombre.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q),
    );
  }, [usuarios, busqueda]);

  async function mutar(id: string, cambio: Partial<Pick<Usuario, 'activo' | 'roles'>>) {
    setGuardando(id);
    setError(null);
    try {
      await api.patch(`/users/${id}`, cambio);
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pude guardar el cambio');
    } finally {
      setGuardando(null);
    }
  }

  async function resetear(u: Usuario) {
    if (!confirm(`¿Resetear la contraseña de ${u.nombre}?\n\nSe generará una temporal y tendrá que cambiarla al entrar.`)) return;
    setGuardando(u.id);
    setError(null);
    try {
      const { temporaryPassword } = await api.post<{ temporaryPassword: string }>(
        `/users/${u.id}/reset-password`,
      );
      setPassTemporal({ nombre: u.nombre, pass: temporaryPassword });
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pude resetear la contraseña');
    } finally {
      setGuardando(null);
    }
  }

  function toggleRol(u: Usuario, rol: Rol) {
    const tiene = u.roles.includes(rol);
    const roles = tiene ? u.roles.filter((r) => r !== rol) : [...u.roles, rol];
    // Un usuario sin roles no podría hacer nada y quedaría en un limbo:
    // el backend lo aceptaría, pero es un estado sin sentido operativo.
    if (roles.length === 0) {
      setError('Un usuario tiene que conservar al menos un rol');
      return;
    }
    void mutar(u.id, { roles });
  }

  const activos = usuarios.filter((u) => u.activo).length;
  const admins = usuarios.filter((u) => u.roles.includes('ADMIN')).length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-semibold flex items-center gap-2">
            <UserCog className="w-5 h-5" style={{ color: 'var(--warm-gray-3)' }} />
            Usuarios
          </h1>
          <p className="m-0 caption" style={{ color: 'var(--warm-gray-3)' }}>
            Altas, roles y reseteo de contraseñas
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setNuevo(true)}>
          <Plus className="w-4 h-4" /> Nuevo usuario
        </button>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: usuarios.length, tint: 'var(--warm-gray-1)' },
          { label: 'Activos', value: activos, tint: 'var(--success)' },
          { label: 'Administradores', value: admins, tint: 'var(--danger)' },
        ].map((s) => (
          <div key={s.label} className="card p-3.5">
            <p className="m-0 caption" style={{ color: 'var(--warm-gray-3)' }}>{s.label}</p>
            <p className="m-0 text-[24px] font-semibold tabular" style={{ color: s.tint }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--warm-gray-3)' }}
        />
        <input
          className="input pl-9 w-full"
          placeholder="Buscar por nombre, usuario o email…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {error && (
        <div className="card p-3 flex items-start justify-between gap-3" style={{ borderColor: 'var(--danger)' }}>
          <span className="text-[13.5px]" style={{ color: 'var(--danger)' }}>{error}</span>
          <button onClick={() => setError(null)} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {passTemporal && (
        <div className="card p-4" style={{ borderColor: 'var(--warning)' }}>
          <p className="m-0 text-[13.5px] font-medium">
            Contraseña temporal de {passTemporal.nombre}
          </p>
          <p className="m-0 caption mb-2" style={{ color: 'var(--warm-gray-3)' }}>
            Se muestra una sola vez. Copiala y entregala en persona — no la mandes por chat.
          </p>
          <div className="flex items-center gap-2">
            <code className="mono text-[15px] px-2.5 py-1.5 rounded" style={{ background: 'var(--warm-gray-6)' }}>
              {passTemporal.pass}
            </code>
            <button
              className="btn btn-ghost"
              onClick={() => void navigator.clipboard?.writeText(passTemporal.pass)}
            >
              Copiar
            </button>
            <button className="btn btn-ghost" onClick={() => setPassTemporal(null)}>
              Listo
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-4 animate-pulse" style={{ height: 76 }} />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="m-0 text-[14px]" style={{ color: 'var(--warm-gray-3)' }}>
            {busqueda ? 'Ningún usuario coincide con la búsqueda' : 'No hay usuarios todavía'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map((u) => {
            const esYo = u.id === yo?.id;
            const ocupado = guardando === u.id;
            return (
              <div key={u.id} className="card p-4 flex flex-wrap items-center gap-4" style={{ opacity: ocupado ? 0.6 : 1 }}>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[14.5px] font-medium truncate flex items-center gap-2">
                    {u.nombre}
                    {esYo && <span className="badge">vos</span>}
                    {!u.activo && <span className="badge badge-danger">inactivo</span>}
                    {u.bloqueado && <span className="badge badge-warning">bloqueado</span>}
                    {u.primerLogin && <span className="badge">debe cambiar clave</span>}
                  </p>
                  <p className="m-0 caption truncate" style={{ color: 'var(--warm-gray-3)' }}>
                    <span className="mono">{u.username}</span>
                    {u.email ? ` · ${u.email}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {ROLES.map((r) => {
                    const tiene = u.roles.includes(r);
                    return (
                      <button
                        key={r}
                        title={rolDescripcion[r]}
                        disabled={ocupado}
                        onClick={() => toggleRol(u, r)}
                        className={`badge ${tiene ? rolBadge[r] : ''}`}
                        style={{
                          cursor: ocupado ? 'default' : 'pointer',
                          opacity: tiene ? 1 : 0.35,
                          border: '1px solid var(--border)',
                        }}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-ghost"
                    disabled={ocupado}
                    onClick={() => void resetear(u)}
                    title="Generar una contraseña temporal"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Clave
                  </button>
                  {/* Desactivarse a sí mismo dejaría al admin fuera del sistema
                      sin forma de volver a entrar. */}
                  <button
                    className="btn btn-ghost"
                    disabled={ocupado || esYo}
                    title={esYo ? 'No podés desactivar tu propia cuenta' : u.activo ? 'Desactivar' : 'Activar'}
                    onClick={() => void mutar(u.id, { activo: !u.activo })}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {nuevo && <NuevoUsuario onCerrar={() => setNuevo(false)} onCreado={() => { setNuevo(false); void cargar(); }} />}
    </div>
  );
}

function NuevoUsuario({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: () => void }) {
  const [form, setForm] = useState({ username: '', nombre: '', email: '', password: '' });
  const [roles, setRoles] = useState<Rol[]>(['OPERADOR']);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (roles.length === 0) {
      setError('Elegí al menos un rol');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await api.post('/auth/register', {
        username: form.username.trim(),
        nombre: form.nombre.trim(),
        email: form.email.trim() || undefined,
        password: form.password,
        roles,
      });
      onCreado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pude crear el usuario');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onCerrar}
    >
      <form
        className="card p-5 w-full max-w-md flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
        onSubmit={enviar}
      >
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-[17px] font-semibold">Nuevo usuario</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="caption">Nombre completo</span>
          <input
            className="input" required autoFocus value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="caption">Usuario</span>
          <input
            className="input mono" required value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="caption">Email (opcional)</span>
          <input
            className="input" type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="caption">Contraseña inicial</span>
          <input
            className="input" type="password" required minLength={6} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <span className="caption" style={{ color: 'var(--warm-gray-3)' }}>
            Mínimo 6 caracteres. Entregala en persona.
          </span>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="caption">Roles</span>
          {ROLES.map((r) => (
            <label key={r} className="flex items-start gap-2 text-[13.5px]">
              <input
                type="checkbox"
                checked={roles.includes(r)}
                onChange={() =>
                  setRoles(roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r])
                }
              />
              <span>
                <strong>{r}</strong>
                <span style={{ color: 'var(--warm-gray-3)' }}> — {rolDescripcion[r]}</span>
              </span>
            </label>
          ))}
        </div>

        {error && (
          <p className="m-0 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </div>
  );
}
