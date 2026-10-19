'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, ChevronRight, FileText } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { eticketsApi } from '@/lib/etickets';

/** Inicio del cadete: saludo y acceso a las entregas pendientes (API real). */
export default function CadetePage() {
  const { user } = useAuth();
  const [pendientes, setPendientes] = useState<number | null>(null);

  useEffect(() => {
    eticketsApi.listCadete().then((r) => setPendientes(r.total)).catch(() => setPendientes(null));
  }, []);

  const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const nombre = user?.nombre.split(' ')[0] ?? '';

  return (
    <div className="page animate-in">
      <header>
        <h1>Hola{nombre ? `, ${nombre}` : ''}</h1>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Calendar className="w-4 h-4" style={{ color: 'var(--warm-gray-3)' }} />
          <p className="text-small m-0 first-letter:uppercase" style={{ color: 'var(--warm-gray-2)' }}>{hoy}</p>
        </div>
      </header>

      <Link href="/cadete/tickets" className="no-underline">
        <div className="card p-5 flex items-center gap-4">
          <span className="grid place-items-center w-12 h-12 shrink-0"
                style={{ borderRadius: 'var(--radius-sm)', background: 'var(--info-subtle)', color: 'var(--info)' }}>
            <FileText className="w-6 h-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="heading-3">Entregas pendientes</h3>
            <p className="text-small m-0 mt-0.5" style={{ color: 'var(--warm-gray-2)' }}>
              {pendientes === null ? 'Ver e-tickets' : `${pendientes} ${pendientes === 1 ? 'e-ticket' : 'e-tickets'} por hacer`}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 shrink-0" style={{ color: 'var(--warm-gray-3)' }} />
        </div>
      </Link>
    </div>
  );
}
