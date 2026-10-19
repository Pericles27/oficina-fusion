'use client';

import { OperationsBoard } from '@/components/OperationsBoard';
import { useCaja } from '@/lib/caja-store';

/**
 * Operaciones del día. Antes era una maqueta con operaciones ficticias;
 * ahora muestra la misma planilla real (API) que el dashboard.
 */
export default function OperationsPage() {
  const { state } = useCaja();

  return (
    <div className="page animate-in">
      <header>
        <h1>Operaciones</h1>
        <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>
          Planilla del día · {state.operaciones.length} ops
        </p>
      </header>
      <OperationsBoard />
    </div>
  );
}
