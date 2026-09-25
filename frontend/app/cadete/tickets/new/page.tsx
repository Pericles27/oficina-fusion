'use client';

import { useState, useMemo } from 'react';
import { ArrowLeft, Send, User, FileText, Mail, MessageSquare, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { Input, Select, Textarea } from '@/components/ui';
import { Badge } from '@/components/ui';
import { toast } from 'sonner';

const clients = [
  { id: '1', name: 'Carlos Méndez', document: '30.123.456-7' },
  { id: '2', name: 'Ana Rodríguez', document: '27.654.321-9' },
  { id: '3', name: 'Miguel Torres', document: '33.789.012-3' },
  { id: '4', name: 'Laura Sánchez', document: '25.456.789-1' },
  { id: '5', name: 'Roberto Díaz', document: '29.987.654-8' },
];

const ticketTypes = [
  { value: 'CFE', label: 'CFE (Comprobante Fiscal Electrónico)' },
  { value: 'Factura B', label: 'Factura B' },
  { value: 'Recibo', label: 'Recibo' },
];

export default function NewTicketPage() {
  const [selectedClient, setSelectedClient] = useState('');
  const [ticketType, setTicketType] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const client = useMemo(
    () => clients.find((c) => c.id === selectedClient),
    [selectedClient]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !ticketType || !deliveryMethod) {
      toast.error('Completa todos los campos requeridos');
      return;
    }
    setSending(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 800));
    setSending(false);
    setSent(true);
    toast.success('E-Ticket enviado correctamente');
  };

  if (sent) {
    return (
      <div className="p-6 space-y-6 max-w-xl">
        <Link
          href="/cadete/tickets"
          className="flex items-center gap-2 text-sm text-[var(--blue)] hover:underline cursor-pointer select-none"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a E-Tickets
        </Link>

        <div className="card p-10 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)] text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--success)]/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-[var(--success)]" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--warm-gray-1)]">Ticket enviado</h2>
          <p className="text-sm text-[var(--warm-gray-2)] mt-2">
            El comprobante fue enviado a {client?.name} vía {deliveryMethod === 'sms' ? 'SMS' : 'Email'}
          </p>
          <div className="mt-6">
            <Link href="/cadete/tickets">
              <Button variant="primary">Ver todos los tickets</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/cadete/tickets">
            <ArrowLeft className="w-5 h-5 text-[var(--warm-gray-2)] cursor-pointer hover:text-[var(--warm-gray-1)] transition-colors" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-[var(--warm-gray-1)]">Nuevo E-Ticket</h1>
            <p className="text-sm text-[var(--warm-gray-2)]">Generar comprobante electrónico</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Client */}
        <div className="card p-5 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <h3 className="text-sm font-semibold text-[var(--warm-gray-1)] mb-4 flex items-center gap-2">
            <User className="w-4 h-4" />
            Cliente
          </h3>
          <Select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            placeholder="Seleccionar cliente..."
            options={clients.map((c) => ({ value: c.id, label: `${c.name} — ${c.document}` }))}
            required
          />
          {client && (
            <div className="mt-3 p-3 rounded-lg bg-[var(--bg-base)]">
              <p className="text-sm font-medium text-[var(--warm-gray-1)]">{client.name}</p>
              <p className="text-xs text-[var(--warm-gray-2)]">DNI/CUIT: {client.document}</p>
            </div>
          )}
        </div>

        {/* Ticket Type */}
        <div className="card p-5 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <h3 className="text-sm font-semibold text-[var(--warm-gray-1)] mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Tipo de comprobante
          </h3>
          <Select
            value={ticketType}
            onChange={(e) => setTicketType(e.target.value)}
            placeholder="Seleccionar tipo..."
            options={ticketTypes.map((t) => ({ value: t.value, label: t.label }))}
            required
          />
        </div>

        {/* Delivery Method */}
        <div className="card p-5 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <h3 className="text-sm font-semibold text-[var(--warm-gray-1)] mb-4 flex items-center gap-2">
            <Send className="w-4 h-4" />
            Método de envío
          </h3>
          <div className="grid grid-2 gap-3">
            <button
              type="button"
              onClick={() => setDeliveryMethod('sms')}
              className={`p-4 rounded-lg border-2 text-center transition-all cursor-pointer ${
                deliveryMethod === 'sms'
                  ? 'border-[var(--blue)] bg-[var(--blue-subtle)]'
                  : 'border-[var(--warm-gray-5)] hover:border-[var(--warm-gray-4)]'
              }`}
            >
              <MessageSquare className={`w-6 h-6 mx-auto mb-2 ${deliveryMethod === 'sms' ? 'text-[var(--blue)]' : 'text-[var(--warm-gray-2)]'}`} />
              <p className="text-sm font-medium text-[var(--warm-gray-1)]">SMS</p>
              <p className="text-xs text-[var(--warm-gray-2)] mt-0.5">Al celular del cliente</p>
            </button>
            <button
              type="button"
              onClick={() => setDeliveryMethod('email')}
              className={`p-4 rounded-lg border-2 text-center transition-all cursor-pointer ${
                deliveryMethod === 'email'
                  ? 'border-[var(--blue)] bg-[var(--blue-subtle)]'
                  : 'border-[var(--warm-gray-5)] hover:border-[var(--warm-gray-4)]'
              }`}
            >
              <Mail className={`w-6 h-6 mx-auto mb-2 ${deliveryMethod === 'email' ? 'text-[var(--blue)]' : 'text-[var(--warm-gray-2)]'}`} />
              <p className="text-sm font-medium text-[var(--warm-gray-1)]">Email</p>
              <p className="text-xs text-[var(--warm-gray-2)] mt-0.5">Al email del cliente</p>
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="card p-5 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <h3 className="text-sm font-semibold text-[var(--warm-gray-1)] mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Notas internas
          </h3>
          <Textarea
            placeholder="Notas para referencia (opcional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {/* Preview */}
        {selectedClient && ticketType && (
          <div className="card p-5 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
            <h3 className="text-sm font-semibold text-[var(--warm-gray-1)] mb-3">Vista previa del ticket</h3>
            <div className="p-4 rounded-lg bg-[var(--bg-base)] border border-[var(--warm-gray-5)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wide">E-Ticket</span>
                <Badge variant="info" size="sm">
                  {ticketType}
                </Badge>
              </div>
              <p className="text-sm text-[var(--warm-gray-1)]">
                <span className="text-[var(--warm-gray-2)]">Para: </span>
                {client?.name}
              </p>
              <p className="text-sm text-[var(--warm-gray-1)] mt-1">
                <span className="text-[var(--warm-gray-2)]">Enviar vía: </span>
                {deliveryMethod === 'sms' ? 'SMS' : deliveryMethod === 'email' ? 'Email' : '—'}
              </p>
              <p className="text-xs text-[var(--warm-gray-2)] mt-2">
                {new Date().toLocaleDateString('es-AR', {
                  day: '2-digit', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Link href="/cadete/tickets">
            <Button variant="ghost">Cancelar</Button>
          </Link>
          <Button variant="primary" loading={sending} className="flex-1 justify-center gap-2">
            <Send className="w-4 h-4" />
            {sending ? 'Enviando...' : 'Enviar E-Ticket'}
          </Button>
        </div>
      </form>
    </div>
  );
}
