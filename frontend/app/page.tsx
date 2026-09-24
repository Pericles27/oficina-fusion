'use client';

import { useCaja } from '@/lib/caja-store';

export default function Home() {
  const { state, dispatch } = useCaja();

  return (
    <main style={{ padding: '40px 20px', maxWidth: 800, margin: '0 auto' }}>
      <h1>🏢 Oficina Fusion</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
        Sistema integral de gestión de oficina financiera
      </p>

      <div style={{ marginTop: 40 }}>
        <h2>Estado actual</h2>
        <div style={{ marginTop: 16, padding: 20, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <p>Día: <strong>{state.diaAbierto ? 'Abierto' : 'Cerrado'}</strong></p>
          <p>Operaciones: <strong>{state.operaciones.length}</strong></p>
          <p>Clientes: <strong>{state.clientes.length}</strong></p>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button
          className="btn btn-primary"
          onClick={() => dispatch({ type: 'ABRIR_DIA' })}
          disabled={state.diaAbierto}
        >
          Abrir día
        </button>
        <button
          className="btn"
          onClick={() => dispatch({ type: 'CERRAR_DIA' })}
          disabled={!state.diaAbierto}
          style={{ marginLeft: 8 }}
        >
          Cerrar día
        </button>
      </div>

      <nav style={{ marginTop: 40 }}>
        <h3>Acceder al sistema</h3>
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <a href="/cadete" className="btn" style={{ textDecoration: 'none' }}>
            👤 Panel Cadete
          </a>
          <a href="/admin" className="btn" style={{ textDecoration: 'none' }}>
            ⚙️ Panel Administrador
          </a>
        </div>
      </nav>
    </main>
  );
}
