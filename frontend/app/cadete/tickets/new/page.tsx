'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Send, FileText, User, DollarSign } from 'lucide-react';
import { Input, Select, Textarea } from '@/components/ui';

const tipoOptions = [
  { value: 'CFE', label: 'CFE — Comp. Fiscal Electrónico' },
  { value: 'Factura B', label: 'Factura B' },
  { value: 'Recibo', label: 'Recibo' },
];

const monedaOptions = [
  { value: 'USD', label: 'USD — Dólar' },
  { value: 'ARS', label: 'ARS — Peso' },
  { value: 'EUR', label: 'EUR — Euro' },
];

export default function NewTicketPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo: 'CFE',
    cliente: '',
    dni: '',
    email: '',
    moneda: 'USD',
    monto: '',
    tasa: '1050',
    concepto: '',
    notas: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const total = (() => {
    const m = parseFloat(form.monto);
    const t = parseFloat(form.tasa);
    return Number.isNaN(m) || Number.isNaN(t) ? 0 : m * t;
  })();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.cliente.trim()) e.cliente = 'Ingresá el nombre del cliente';
    if (!form.dni.trim()) e.dni = 'Ingresá el DNI';
    if (!form.monto || parseFloat(form.monto) <= 0) e.monto = 'Ingresá un monto válido';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Email inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (send: boolean) => {
    if (!validate()) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    router.push('/cadete/tickets');
  };

  return (
    <div className="page animate-in">
      <header className="flex flex-col gap-3">
        <Link href="/cadete/tickets"
              className="inline-flex items-center gap-1.5 text-small no-underline w-fit"
              style={{ color: 'var(--warm-gray-2)' }}>
          <ArrowLeft className="w-4 h-4" />
          Volver a E-Tickets
        </Link>
        <div>
          <h1>Nuevo E-Ticket</h1>
          <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>
            Generar comprobante electrónico
          </p>
        </div>
      </header>

      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
        {/* Tipo */}
        <section className="card p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-[18px] h-[18px]" style={{ color: 'var(--blue)' }} />
            <span className="label">Tipo de comprobante</span>
          </div>
          <Select options={tipoOptions} value={form.tipo} onChange={set('tipo')} aria-label="Tipo" />
        </section>

        {/* Cliente */}
        <section className="card p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <User className="w-[18px] h-[18px]" style={{ color: 'var(--blue)' }} />
            <span className="label">Datos del cliente</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nombre completo" placeholder="Carlos Méndez"
                   value={form.cliente} onChange={set('cliente')} error={errors.cliente} required />
            <Input label="DNI / CUIT" placeholder="30.456.789" inputMode="numeric"
                   value={form.dni} onChange={set('dni')} error={errors.dni} required />
          </div>
          <Input label="Email" type="email" placeholder="cliente@email.com"
                 helperText="Opcional — para enviar el comprobante"
                 value={form.email} onChange={set('email')} error={errors.email} />
        </section>

        {/* Montos */}
        <section className="card p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-[18px] h-[18px]" style={{ color: 'var(--blue)' }} />
            <span className="label">Importe</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label="Moneda" options={monedaOptions} value={form.moneda} onChange={set('moneda')} />
            <Input label="Monto" type="number" inputMode="decimal" placeholder="0,00" step="0.01"
                   value={form.monto} onChange={set('monto')} error={errors.monto} required />
            <Input label="Tasa" type="number" inputMode="decimal" placeholder="1050" step="0.01"
                   value={form.tasa} onChange={set('tasa')} />
          </div>

          <div className="flex items-center justify-between gap-3 pt-4 flex-wrap"
               style={{ borderTop: '1px solid var(--border)' }}>
            <span className="label">Total ARS</span>
            <span className="text-[22px] font-bold currency" style={{ color: 'var(--blue)' }}>
              ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </section>

        {/* Detalle */}
        <section className="card p-5 flex flex-col gap-4">
          <span className="label">Detalle</span>
          <Input label="Concepto" placeholder="Compra de divisas"
                 value={form.concepto} onChange={set('concepto')} />
          <Textarea label="Notas internas" rows={3} placeholder="Observaciones (no se imprimen)"
                    value={form.notas} onChange={set('notas')} />
        </section>

        {/* Acciones al final del formulario (sin sticky: no tapa campos) */}
        <div className="flex flex-col xs:flex-row gap-2.5 pt-1">
          <button type="submit" className="btn btn-secondary btn-full xs:w-auto" disabled={saving}>
            <Save className="w-4 h-4" />
            Guardar borrador
          </button>
          <button type="button" className="btn btn-primary btn-full xs:flex-1"
                  onClick={() => submit(true)} disabled={saving}>
            <Send className="w-4 h-4" />
            {saving ? 'Generando…' : 'Generar y enviar'}
          </button>
        </div>
      </form>
    </div>
  );
}
