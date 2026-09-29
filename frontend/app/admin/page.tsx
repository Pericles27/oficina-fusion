'use client';

import { Sun, Moon } from 'lucide-react';
import { OperationsBoard } from '@/components/OperationsBoard';
import { useCaja } from '@/lib/caja-store';

export default function AdminPage() {
  const { state, dispatch } = useCaja();

  return (
    <div className="page animate-in">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1>Mesa de Operaciones</h1>
          <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>
            Carga y seguimiento en planilla · {state.operaciones.length} ops del día
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className={`badge ${state.diaAbierto ? 'badge-success' : 'badge-neutral'}`}>
            {state.diaAbierto ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            Día {state.diaAbierto ? 'abierto' : 'cerrado'}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => dispatch({ type: state.diaAbierto ? 'CERRAR_DIA' : 'ABRIR_DIA' })}
          >
            {state.diaAbierto ? 'Cerrar día' : 'Abrir día'}
          </button>
        </div>
      </header>

      <OperationsBoard />
    </div>
  );
}
