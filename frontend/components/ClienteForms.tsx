'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { customersApi, type Cliente, type ClienteTipo } from '@/lib/customers';

const errorDe = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export function Dialogo({ titulo, onCerrar, children, ancho = 'max-w-md' }: {
  titulo: string; onCerrar: () => void; children: React.ReactNode; ancho?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--overlay)' }} onClick={onCerrar}>
      <div
        className={`card p-5 w-full ${ancho} flex flex-col gap-3 overflow-y-auto`}
        style={{ maxHeight: 'calc(100dvh - 32px)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={titulo}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-[17px] font-semibold">{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="caption">{label}</span>
      {children}
    </label>
  );
}

/** Alta de cliente (C3). También la usa la planilla (B3) con el nombre precargado. */
export function NuevoCliente({ nombreInicial = '', onCerrar, onCreado }: {
  nombreInicial?: string; onCerrar: () => void; onCreado: (c: Cliente) => void;
}) {
  const [form, setForm] = useState({ nombre: nombreInicial, apellido: '', tipo: 'Persona' as ClienteTipo, doc: '', notas: '' });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const creado = await customersApi.create({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim() || undefined,
        tipo: form.tipo,
        doc: form.doc.trim() || undefined,
        notas: form.notas.trim() || undefined,
      });
      onCreado(creado);
    } catch (err) {
      setError(errorDe(err, 'No pude crear el cliente'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo="Nuevo cliente" onCerrar={onCerrar}>
      <form className="flex flex-col gap-3" onSubmit={enviar}>
        <Campo label="Nombre">
          <input className="input" required autoFocus value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </Campo>
        <Campo label="Apellido (opcional)">
          <input className="input" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
        </Campo>
        <Campo label="Tipo">
          <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as ClienteTipo })}>
            <option value="Persona">Persona</option>
            <option value="Empresa">Empresa</option>
          </select>
        </Campo>
        <Campo label="DNI / CUIT (opcional)">
          <input className="input mono" value={form.doc} onChange={(e) => setForm({ ...form, doc: e.target.value })} />
        </Campo>
        <Campo label="Notas (opcional)">
          <textarea className="input" rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
        </Campo>
        {error && <p className="m-0 text-[13px]" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={enviando}>{enviando ? 'Guardando…' : 'Crear cliente'}</button>
        </div>
      </form>
    </Dialogo>
  );
}

