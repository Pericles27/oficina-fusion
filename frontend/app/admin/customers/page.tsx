'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Building2, ChevronRight, MapPin, Plus, Search, Trash2, Wallet, X } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCaja } from '@/lib/caja-store';
import { Campo, Dialogo, NuevoCliente } from '@/components/ClienteForms';
import {
  customersApi, nombreCliente, CUSTODIA_LABEL, TIPO_CUENTA_LABEL,
  type Cliente, type ClienteDireccion, type CuentaCliente, type Custodia, type MonedaCuenta, type SaldoMovimiento, type TipoCuenta,
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

const fmt = (v: string | number) =>
  Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = (v: string | number) => `US$ ${fmt(v)}`;

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
              {Number(c.saldoUsd) !== 0 && (
                <span className="currency text-[13.5px] shrink-0" style={{ color: Number(c.saldoUsd) < 0 ? 'var(--danger)' : undefined }}>
                  {usd(c.saldoUsd)}
                </span>
              )}
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
        <DetalleCliente
          cliente={seleccionado}
          editable={esAdmin}
          onCerrar={() => setSeleccionado(null)}
          onCambio={(c) => { setSeleccionado(c); setClientes((cs) => cs.map((x) => (x.id === c.id ? c : x))); }}
          onEliminado={() => { setSeleccionado(null); void cargar(busqueda); }}
        />
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

function DetalleCliente({ cliente, editable, onCerrar, onCambio, onEliminado }: {
  cliente: Cliente; editable: boolean; onCerrar: () => void; onCambio: (c: Cliente) => void; onEliminado: () => void;
}) {
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

      <SaldoCliente cliente={cliente} editable={editable} onCambio={onCambio} />

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

      {editable && <EliminarCliente cliente={cliente} onEliminado={onEliminado} />}
    </Dialogo>
  );
}

/**
 * #19 — Saldo del cliente con la oficina, siempre en USD. Puede quedar negativo
 * (no es lo habitual). La custodia define si el saldo está dentro de la caja: sólo
 * entonces sus movimientos cuentan en el saldo esperado del cierre. Los movimientos
 * manuales (el cliente entrega efectivo o retira) los carga el ADMIN.
 */
function SaldoCliente({ cliente, editable, onCambio }: {
  cliente: Cliente; editable: boolean; onCambio: (c: Cliente) => void;
}) {
  const [movimientos, setMovimientos] = useState<SaldoMovimiento[]>([]);
  const [form, setForm] = useState<{ tipo: 'credito' | 'debito'; monto: string; nota: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saldo = Number(cliente.saldoUsd);
  const custodia: Custodia = cliente.custodia ?? 'caja';

  const cargar = useCallback(async () => {
    try {
      setMovimientos(await customersApi.saldoMovimientos(cliente.id));
    } catch (e) {
      setError(errorDe(e, 'No pude cargar los movimientos de saldo'));
    }
  }, [cliente.id]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function cambiarCustodia(c: Custodia) {
    setError(null);
    try { onCambio(await customersApi.update(cliente.id, { custodia: c })); } catch (e) { setError(errorDe(e, 'No pude guardar el cambio')); }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setEnviando(true);
    setError(null);
    try {
      const actualizado = await customersApi.moverSaldo(cliente.id, {
        tipo: form.tipo,
        montoUsd: form.monto.trim().replace(',', '.'),
        nota: form.nota.trim() || undefined,
      });
      setForm(null);
      onCambio(actualizado);
      await cargar();
    } catch (err) {
      setError(errorDe(err, 'No pude registrar el movimiento'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="m-0 text-[15px] font-semibold flex items-center gap-1.5"><Wallet className="w-4 h-4" /> Saldo</h3>
        {editable && !form && (
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-sm" onClick={() => setForm({ tipo: 'credito', monto: '', nota: '' })}>
              <ArrowDownLeft className="w-3.5 h-3.5" /> Ingreso
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setForm({ tipo: 'debito', monto: '', nota: '' })}>
              <ArrowUpRight className="w-3.5 h-3.5" /> Retiro
            </button>
          </div>
        )}
      </div>
      <div className="p-3 rounded-lg flex items-center justify-between gap-3 flex-wrap" style={{ background: 'var(--bg-base)' }}>
        <span className="currency text-[20px] font-semibold" style={{ color: saldo < 0 ? 'var(--danger)' : undefined }}>
          {usd(cliente.saldoUsd)}
        </span>
        {editable ? (
          <select className="input input-sm" style={{ width: 'auto' }} value={custodia} aria-label="Custodia del saldo"
                  onChange={(e) => void cambiarCustodia(e.target.value as Custodia)}>
            <option value="caja">{CUSTODIA_LABEL.caja}</option>
            <option value="separada">{CUSTODIA_LABEL.separada}</option>
          </select>
        ) : (
          <span className="caption" style={{ color: 'var(--warm-gray-3)' }}>{CUSTODIA_LABEL[custodia]}</span>
        )}
      </div>
      {saldo < 0 && (
        <p className="m-0 caption" style={{ color: 'var(--danger)' }}>El cliente le debe a la oficina.</p>
      )}
      {error && <p className="m-0 text-[13px]" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}

      {form && (
        <form className="card p-3 flex flex-col gap-2" onSubmit={enviar}>
          <p className="m-0 text-[13.5px] font-medium">
            {form.tipo === 'credito' ? 'El cliente entrega efectivo y suma saldo' : 'El cliente retira de su saldo'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
            <Campo label="Monto (USD)">
              <input className="input currency" required autoFocus inputMode="decimal" placeholder="0,00"
                     value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
            </Campo>
            <Campo label="Nota">
              <input className="input" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
            </Campo>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(null)} disabled={enviando}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={enviando}>
              {enviando ? 'Guardando…' : form.tipo === 'credito' ? 'Registrar ingreso' : 'Registrar retiro'}
            </button>
          </div>
        </form>
      )}

      {movimientos.length > 0 && (
        <ul className="list-none p-0 m-0 flex flex-col">
          {movimientos.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-1.5 caption" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="min-w-0 truncate" style={{ color: 'var(--warm-gray-3)' }}>
                {new Date(m.ts).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                {' · '}
                {m.operacion ? `Operación ${m.operacion.codigo}` : m.tipo === 'credito' ? 'Ingreso' : 'Retiro'}
                {m.nota && !m.operacion ? ` · ${m.nota}` : ''}
              </span>
              <span className="currency shrink-0" style={{ color: m.tipo === 'debito' ? 'var(--danger)' : 'var(--success)' }}>
                {Number(m.montoUsd) > 0 ? '+' : ''}{fmt(m.montoUsd)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * #11 — Baja de cliente. Se usa poco: queda al pie del detalle, como texto
 * discreto, y pide confirmación. Es baja lógica (DELETE /customers/:id marca
 * activo = false), así que sus operaciones y e-tickets se conservan.
 */
function EliminarCliente({ cliente, onEliminado }: { cliente: Cliente; onEliminado: () => void }) {
  const { dispatch } = useCaja();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function eliminar() {
    setEnviando(true);
    setError(null);
    try {
      await customersApi.remove(cliente.id);
      dispatch({ type: 'REMOVE_CLIENTE', id: cliente.id });
      onEliminado();
    } catch (e) {
      setError(errorDe(e, 'No pude eliminar el cliente'));
      setEnviando(false);
    }
  }

  if (!confirmando) {
    return (
      <div className="flex justify-end pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button type="button" className="caption" style={{ color: 'var(--warm-gray-3)' }} onClick={() => setConfirmando(true)}>
          Eliminar cliente…
        </button>
      </div>
    );
  }

  return (
    <div className="card p-3 flex flex-col gap-2" style={{ borderColor: 'var(--danger)' }} role="alertdialog" aria-label="Confirmar eliminación">
      <p className="m-0 text-[13.5px]">
        ¿Eliminar a <strong>{nombreCliente(cliente)}</strong>? Deja de aparecer en la lista y en la planilla.
        Sus operaciones y e-tickets se conservan.
      </p>
      {error && <p className="m-0 text-[13px]" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmando(false)} disabled={enviando}>Cancelar</button>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => void eliminar()} disabled={enviando}>
          <Trash2 className="w-3.5 h-3.5" />
          {enviando ? 'Eliminando…' : 'Sí, eliminar'}
        </button>
      </div>
    </div>
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
