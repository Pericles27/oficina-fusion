'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, ChevronRight, MapPin, Plus, Search, Trash2, X } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Campo, Dialogo, NuevoCliente } from '@/components/ClienteForms';
import {
  customersApi, nombreCliente, TIPO_CUENTA_LABEL,
  type Cliente, type ClienteDireccion, type CuentaCliente, type MonedaCuenta, type TipoCuenta,
} from '@/lib/customers';

/**
 * C3 — Clientes conectados a la API (#3 + #4).
 *
 * Lista y alta contra `/customers`; el detalle muestra direcciones y cuentas
 * bancarias del cliente. Las validaciones de verdad (CBU de 22 dígitos, moneda
 * ARS/USD obligatoria, permisos) las hace el backend: acá sólo se muestran sus
 * errores.
 */

const errorDe = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export default function CustomersPage() {
  const { user } = useAuth();
  const esAdmin = !!user?.roles.includes('ADMIN');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [seleccionado, setSeleccionado] = useState<Cliente | null>(null);

  const cargar = useCallback(async (q: string) => {
    setCargando(true);
    setError(null);
    try {
      const res = await customersApi.list(q.trim());
      setClientes(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(errorDe(e, 'No pude cargar los clientes'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void cargar(busqueda), 250);
    return () => clearTimeout(t);
  }, [busqueda, cargar]);

  return (
    <div className="page animate-in">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1>Clientes</h1>
          <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>
            Datos de contacto, direcciones y cuentas bancarias
          </p>
        </div>
        {esAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => setNuevo(true)}>
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
        )}
      </header>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--warm-gray-3)' }} />
        <input
          className="input input-icon-left w-full"
          placeholder="Buscar por nombre, alias o documento…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar clientes"
        />
      </div>

      {error && <Aviso texto={error} onCerrar={() => setError(null)} />}

      {cargando ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="card p-4 animate-pulse" style={{ height: 64 }} />)}
        </div>
      ) : clientes.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="m-0 text-[14px]" style={{ color: 'var(--warm-gray-3)' }}>
            {busqueda ? 'Ningún cliente coincide con la búsqueda' : 'Todavía no hay clientes cargados'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="caption tabular" style={{ color: 'var(--warm-gray-3)' }}>
            {clientes.length} de {total}
          </span>
          {clientes.map((c) => (
            <button
              key={c.id}
              className="card p-4 flex items-center gap-3 text-left w-full"
              onClick={() => setSeleccionado(c)}
            >
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[14.5px] font-medium truncate flex items-center gap-2">
                  {nombreCliente(c)}
                  {c.alias && <span className="caption" style={{ color: 'var(--warm-gray-3)' }}>«{c.alias}»</span>}
                  {!c.activo && <span className="badge badge-danger">inactivo</span>}
                </p>
                <p className="m-0 caption truncate" style={{ color: 'var(--warm-gray-3)' }}>
                  {c.tipo}{c.doc ? ` · ${c.doc}` : ''}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--warm-gray-3)' }} />
            </button>
          ))}
        </div>
      )}

      {nuevo && (
        <NuevoCliente
          onCerrar={() => setNuevo(false)}
          onCreado={(c) => { setNuevo(false); void cargar(busqueda); setSeleccionado(c); }}
        />
      )}
      {seleccionado && (
        <DetalleCliente cliente={seleccionado} editable={esAdmin} onCerrar={() => setSeleccionado(null)} />
      )}
    </div>
  );
}

function Aviso({ texto, onCerrar }: { texto: string; onCerrar?: () => void }) {
  return (
    <div className="card p-3 flex items-start justify-between gap-3" style={{ borderColor: 'var(--danger)' }} role="alert">
      <span className="text-[13.5px]" style={{ color: 'var(--danger)' }}>{texto}</span>
      {onCerrar && <button onClick={onCerrar} aria-label="Cerrar"><X className="w-4 h-4" /></button>}
    </div>
  );
}

function DetalleCliente({ cliente, editable, onCerrar }: { cliente: Cliente; editable: boolean; onCerrar: () => void }) {
  const [direcciones, setDirecciones] = useState<ClienteDireccion[]>([]);
  const [cuentas, setCuentas] = useState<CuentaCliente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<'direccion' | 'cuenta' | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([customersApi.addresses(cliente.id), customersApi.accounts(cliente.id)]);
      setDirecciones(d);
      setCuentas(c.filter((x) => x.activo));
    } catch (e) {
      setError(errorDe(e, 'No pude cargar el detalle del cliente'));
    }
  }, [cliente.id]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function quitar(accion: () => Promise<unknown>) {
    setError(null);
    try { await accion(); await cargar(); } catch (e) { setError(errorDe(e, 'No pude guardar el cambio')); }
  }

  return (
    <Dialogo titulo={nombreCliente(cliente)} onCerrar={onCerrar} ancho="max-w-xl">
      <p className="m-0 caption" style={{ color: 'var(--warm-gray-3)' }}>
        {cliente.tipo}{cliente.doc ? ` · ${cliente.doc}` : ''}{cliente.notas ? ` · ${cliente.notas}` : ''}
      </p>
      {error && <Aviso texto={error} onCerrar={() => setError(null)} />}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-[15px] font-semibold flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Direcciones</h3>
          {editable && form !== 'direccion' && (
            <button className="btn btn-ghost btn-sm" onClick={() => setForm('direccion')}><Plus className="w-3.5 h-3.5" /> Agregar</button>
          )}
        </div>
        {direcciones.length === 0 && form !== 'direccion' && (
          <p className="m-0 caption" style={{ color: 'var(--warm-gray-3)' }}>Sin direcciones cargadas</p>
        )}
        {direcciones.map((d) => (
          <div key={d.id} className="flex items-start justify-between gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-base)' }}>
            <div className="min-w-0">
              <p className="m-0 text-[14px] font-medium">
                {d.direccion} {d.principal && <span className="badge badge-success">principal</span>}
              </p>
              <p className="m-0 caption" style={{ color: 'var(--warm-gray-3)' }}>
                {[d.ciudad, d.provincia, d.codigoPost && `CP ${d.codigoPost}`].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            {editable && (
              <button aria-label={`Quitar ${d.direccion}`} onClick={() => void quitar(() => customersApi.removeAddress(cliente.id, d.id))}>
                <Trash2 className="w-4 h-4" style={{ color: 'var(--warm-gray-3)' }} />
              </button>
            )}
          </div>
        ))}
        {form === 'direccion' && (
          <FormDireccion clienteId={cliente.id} onCancelar={() => setForm(null)} onGuardado={() => { setForm(null); void cargar(); }} />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-[15px] font-semibold flex items-center gap-1.5"><Building2 className="w-4 h-4" /> Cuentas bancarias</h3>
          {editable && form !== 'cuenta' && (
            <button className="btn btn-ghost btn-sm" onClick={() => setForm('cuenta')}><Plus className="w-3.5 h-3.5" /> Agregar</button>
          )}
        </div>
        {cuentas.length === 0 && form !== 'cuenta' && (
          <p className="m-0 caption" style={{ color: 'var(--warm-gray-3)' }}>Sin cuentas cargadas</p>
        )}
        {cuentas.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-base)' }}>
            <div className="min-w-0">
              <p className="m-0 text-[14px] font-medium">
                {c.banco} · {c.tipoCuenta ? TIPO_CUENTA_LABEL[c.tipoCuenta] : 'Tipo sin definir'}
                {c.monedaCuenta && <span className="badge ml-1.5">{c.monedaCuenta}</span>}
              </p>
              <dl className="m-0 mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 caption">
                {c.numeroCuenta && <><dt style={{ color: 'var(--warm-gray-3)' }}>Número</dt><dd className="m-0 mono">{c.numeroCuenta}</dd></>}
                {c.cbu && <><dt style={{ color: 'var(--warm-gray-3)' }}>CBU</dt><dd className="m-0 mono break-all">{c.cbu}</dd></>}
                {c.alias && <><dt style={{ color: 'var(--warm-gray-3)' }}>Alias</dt><dd className="m-0 mono">{c.alias}</dd></>}
                {c.titular && <><dt style={{ color: 'var(--warm-gray-3)' }}>Titular</dt><dd className="m-0">{c.titular}</dd></>}
                {c.cuitTitular && <><dt style={{ color: 'var(--warm-gray-3)' }}>CUIT</dt><dd className="m-0 mono">{c.cuitTitular}</dd></>}
              </dl>
            </div>
            {editable && (
              <button aria-label={`Quitar cuenta ${c.banco}`} onClick={() => void quitar(() => customersApi.removeAccount(cliente.id, c.id))}>
                <Trash2 className="w-4 h-4" style={{ color: 'var(--warm-gray-3)' }} />
              </button>
            )}
          </div>
        ))}
        {form === 'cuenta' && (
          <FormCuenta clienteId={cliente.id} onCancelar={() => setForm(null)} onGuardado={() => { setForm(null); void cargar(); }} />
        )}
      </section>
    </Dialogo>
  );
}

function FormDireccion({ clienteId, onCancelar, onGuardado }: { clienteId: string; onCancelar: () => void; onGuardado: () => void }) {
  const [f, setF] = useState({ direccion: '', ciudad: '', provincia: '', codigoPost: '', principal: false });
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await customersApi.addAddress(clienteId, {
        direccion: f.direccion.trim(),
        ciudad: f.ciudad.trim() || undefined, provincia: f.provincia.trim() || undefined,
        codigoPost: f.codigoPost.trim() || undefined, principal: f.principal,
      });
      onGuardado();
    } catch (err) {
      setError(errorDe(err, 'No pude guardar la dirección'));
    }
  }

  return (
    <form className="card p-3 flex flex-col gap-2" onSubmit={enviar}>
      <Campo label="Dirección"><input className="input" required autoFocus value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></Campo>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Campo label="Ciudad"><input className="input" value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })} /></Campo>
        <Campo label="Provincia"><input className="input" value={f.provincia} onChange={(e) => setF({ ...f, provincia: e.target.value })} /></Campo>
        <Campo label="Código postal"><input className="input" value={f.codigoPost} onChange={(e) => setF({ ...f, codigoPost: e.target.value })} /></Campo>
      </div>
      <label className="flex items-center gap-2 text-[13.5px]">
        <input type="checkbox" checked={f.principal} onChange={(e) => setF({ ...f, principal: e.target.checked })} /> Principal
      </label>
      {error && <p className="m-0 text-[13px]" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="btn btn-primary btn-sm">Guardar dirección</button>
      </div>
    </form>
  );
}

function FormCuenta({ clienteId, onCancelar, onGuardado }: { clienteId: string; onCancelar: () => void; onGuardado: () => void }) {
  const [f, setF] = useState({
    banco: '', tipoCuenta: '' as TipoCuenta | '', monedaCuenta: '' as MonedaCuenta | '',
    numeroCuenta: '', cbu: '', alias: '', titular: '', cuitTitular: '',
  });
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const identificador = f.numeroCuenta.trim() || f.cbu.trim() || f.alias.trim();
    if (!identificador) {
      setError('Cargá al menos número de cuenta, CBU o alias');
      return;
    }
    try {
      await customersApi.addAccount(clienteId, {
        banco: f.banco.trim(),
        // `numero` es el identificador histórico (único por cliente).
        numero: identificador,
        titular: f.titular.trim() || undefined,
        tipoCuenta: f.tipoCuenta || null,
        monedaCuenta: (f.monedaCuenta || undefined) as MonedaCuenta,
        numeroCuenta: f.numeroCuenta.trim() || null,
        // Se manda tal cual: el backend rechaza un CBU que no tenga 22 dígitos.
        cbu: f.cbu.trim() || null,
        alias: f.alias.trim() || null,
        cuitTitular: f.cuitTitular.trim() || null,
      });
      onGuardado();
    } catch (err) {
      setError(errorDe(err, 'No pude guardar la cuenta'));
    }
  }

  return (
    <form className="card p-3 flex flex-col gap-2" onSubmit={enviar}>
      <Campo label="Banco"><input className="input" required autoFocus value={f.banco} onChange={(e) => setF({ ...f, banco: e.target.value })} /></Campo>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Tipo de cuenta">
          <select className="input" value={f.tipoCuenta} onChange={(e) => setF({ ...f, tipoCuenta: e.target.value as TipoCuenta | '' })} aria-label="Tipo de cuenta">
            <option value="">Elegir…</option>
            <option value="CAJA_AHORRO">Caja de ahorro</option>
            <option value="CUENTA_CORRIENTE">Cuenta corriente</option>
          </select>
        </Campo>
        <Campo label="Moneda">
          <select className="input" required value={f.monedaCuenta} onChange={(e) => setF({ ...f, monedaCuenta: e.target.value as MonedaCuenta | '' })} aria-label="Moneda de la cuenta">
            <option value="">Elegir…</option>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </Campo>
      </div>
      <Campo label="Número de cuenta"><input className="input mono" value={f.numeroCuenta} onChange={(e) => setF({ ...f, numeroCuenta: e.target.value })} /></Campo>
      <Campo label="CBU (22 dígitos)"><input className="input mono" inputMode="numeric" value={f.cbu} onChange={(e) => setF({ ...f, cbu: e.target.value })} /></Campo>
      <Campo label="Alias"><input className="input mono" value={f.alias} onChange={(e) => setF({ ...f, alias: e.target.value })} /></Campo>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Campo label="Titular"><input className="input" value={f.titular} onChange={(e) => setF({ ...f, titular: e.target.value })} /></Campo>
        <Campo label="CUIT del titular"><input className="input mono" value={f.cuitTitular} onChange={(e) => setF({ ...f, cuitTitular: e.target.value })} /></Campo>
      </div>
      {error && <p className="m-0 text-[13px]" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="btn btn-primary btn-sm">Guardar cuenta</button>
      </div>
    </form>
  );
}
