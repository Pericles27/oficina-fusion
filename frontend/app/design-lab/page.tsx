'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Panel, PanelBody, PanelHeader, PanelTitle } from '@/components/ui/Panel';
import './lab.css';
import '../../styles/variants/a.css';
import '../../styles/variants/b.css';
import '../../styles/variants/c.css';

type Variant = 'current' | 'a' | 'b' | 'c';
type Screen = 'operations' | 'ticket' | 'customer';
const variants: Record<Variant, string> = { current: 'Actual · referencia A1', a: 'A · Sistema', b: 'B · Editorial', c: 'C · Vidrio contenido' };
const screens: Record<Screen, string> = { operations: 'Operaciones', ticket: 'E-ticket cadete', customer: 'Detalle cliente' };

// Fixtures inventados para diseño; importes canónicos como texto, sin conexión al store.
const operations = [
  ['SIM-001', 'Cliente Ámbar · ficticio', 'Compra', 'USD 1.000,00', 'Pendiente'],
  ['SIM-002', 'Cliente Bruma · ficticio', 'Venta', 'USD 250,00', 'En curso'],
  ['SIM-003', 'Cliente Cedro · ficticio', 'Compra', 'USD 500,00', 'Finalizada'],
  ['SIM-004', 'Cliente Duna · ficticio', 'Venta', 'USD 750,00', 'Pendiente'],
  ['SIM-005', 'Cliente Estela · ficticio', 'Compra', 'USD 100,00', 'Finalizada'],
];

export default function DesignLab() {
  const [variant, setVariant] = useState<Variant>('current');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [screen, setScreen] = useState<Screen>('operations');
  const [query, setQuery] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('variant');
    const s = params.get('screen');
    if (v && Object.hasOwn(variants, v)) setVariant(v as Variant);
    if (s && Object.hasOwn(screens, s)) setScreen(s as Screen);
    if (params.get('theme') === 'dark') setTheme('dark');
  }, []);

  return (
    <div className="design-lab" data-variant={variant} data-theme={theme} data-screen={screen}>
      <header className="lab-controls" aria-label="Controles del laboratorio">
        <div><strong>OF / Design lab</strong><p>SOLO FIXTURES SINTÉTICOS · Datos locales de muestra</p></div>
        <div className="lab-control-row">
          <label>Variante<select aria-label="Variante" value={variant} onChange={e => setVariant(e.target.value as Variant)}>{Object.entries(variants).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
          <label>Tema<select aria-label="Tema" value={theme} onChange={e => setTheme(e.target.value as 'light' | 'dark')}><option value="light">Claro</option><option value="dark">Oscuro</option></select></label>
        </div>
      </header>
      <nav className="lab-navbar glass" aria-label="Pantallas sintéticas">
        <strong className="lab-brand">oficina<span> / exploraciones</span></strong>
        <div className="lab-tabs">{Object.entries(screens).map(([key, value]) => <button key={key} type="button" aria-pressed={screen === key} onClick={() => { setScreen(key as Screen); setConfirmed(false); }}>{value}</button>)}</div>
      </nav>
      <main className="lab-main">
        <div className="lab-heading"><p className="lab-eyebrow">{variants[variant]} / {theme === 'light' ? 'Claro' : 'Oscuro'} / Muestra sintética</p><h1>{screen === 'operations' ? 'La mesa, en orden.' : screen === 'ticket' ? 'Tu próxima entrega.' : 'Cada vínculo, claro.'}</h1><p className="lab-muted">{screen === 'operations' ? 'Actividad de demostración · jornada ficticia 17 oct 2026' : screen === 'ticket' ? 'Vista cadete · sin información económica' : 'Ficha de demostración · no representa una persona real'}</p></div>
        {screen === 'operations' && <>
          <section className="lab-metrics" aria-label="Resumen sintético">{[['Operaciones', '05', 'En esta muestra'], ['Pendientes', '02', 'Requieren revisión'], ['Finalizadas', '02', 'Flujo completado']].map(([label, value, detail]) => <div className="card stat-card" key={label}><span className="lab-muted">{label}</span><strong className="lab-number">{value}</strong><span className="lab-muted">{detail}</span></div>)}</section>
          <Panel aria-label="Operaciones sintéticas"><PanelHeader><PanelTitle>Actividad de la mesa</PanelTitle><Badge variant="neutral">Demostración</Badge></PanelHeader><PanelBody><label className="lab-search">Buscar cliente<input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre ficticio" /></label><div className="table-wrap"><table className="table"><caption className="lab-sr-only">Cinco operaciones inventadas para comparar estilos</caption><thead><tr>{['Referencia', 'Cliente', 'Tipo', 'Monto sintético', 'Estado'].map(x => <th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{operations.filter(row => row[1].toLowerCase().includes(query.toLowerCase())).map(row => <tr key={row[0]}>{row.map((value, i) => <td key={i}>{i === 4 ? <Badge variant={value === 'Finalizada' ? 'success' : value === 'Pendiente' ? 'warning' : 'blue'}>{value}</Badge> : value}</td>)}</tr>)}</tbody></table></div><p className="lab-muted lab-note">Sin persistencia. Los cambios de esta muestra se descartan al recargar.</p></PanelBody></Panel>
        </>}
        {screen === 'ticket' && <div className="lab-ticket">
          <Panel aria-label="E-ticket sintético"><PanelHeader><PanelTitle>SIM-TK-021</PanelTitle><Badge variant="blue">{confirmed ? 'Confirmada' : 'En ruta'}</Badge></PanelHeader><PanelBody><p className="lab-eyebrow">01 / DESTINO DE PRUEBA</p><h2>Cliente Ámbar</h2><p className="lab-muted">Identidad ficticia · entrega de prueba</p><dl className="lab-list"><div><dt>Dirección ficticia</dt><dd>Pasaje Ejemplo 123<br />Ciudad de Prueba</dd></div><div><dt>Ventana de entrega</dt><dd>14:00–15:00 · simulada</dd></div><div><dt>Recibe</dt><dd>Persona Demo A</dd></div></dl><div className="lab-callout"><strong>Antes de confirmar</strong><p>Verificar la referencia SIM-TK-021 con la persona de prueba.</p></div><ol className="lab-steps"><li>Revisar destino</li><li>Verificar referencia</li><li>Confirmar entrega simulada</li></ol><Button fullWidth onClick={() => setConfirmed(true)}>{confirmed ? 'Entrega simulada confirmada' : 'Confirmar entrega de prueba'}</Button><p className="lab-muted lab-note" role="status">{confirmed ? 'Confirmación local. No se guardó ni envió información.' : 'Acción local de laboratorio. Sin importes ni datos bancarios.'}</p></PanelBody></Panel>
        </div>}
        {screen === 'customer' && <div className="lab-customer-grid">
          <Panel aria-label="Perfil sintético"><PanelBody><div className="lab-monogram" aria-hidden="true">Á</div><p className="lab-eyebrow">SIM-CLI-001</p><h2>Cliente Ámbar</h2><p className="lab-muted">Perfil íntegramente ficticio</p><Badge variant="success">Activo · muestra</Badge><dl className="lab-list"><div><dt>Correo de prueba</dt><dd>ambar@example.invalid</dd></div><div><dt>Dirección ficticia</dt><dd>Pasaje Ejemplo 123</dd></div><div><dt>Preferencia de contacto</dt><dd>Correo · simulado</dd></div></dl></PanelBody></Panel>
          <Panel aria-label="Historial sintético"><PanelHeader><PanelTitle>Relación y actividad</PanelTitle><Badge variant="neutral">Sin datos reales</Badge></PanelHeader><PanelBody><h2>Un historial legible.</h2><p className="lab-muted">Eventos de ejemplo, sin saldos ni cuentas reales.</p><dl className="lab-list"><div><dt>17 oct · 14:20</dt><dd>Entrega de prueba asignada<small>Referencia SIM-TK-021</small></dd></div><div><dt>17 oct · 11:00</dt><dd>Operación sintética creada<small>Referencia SIM-001</small></dd></div><div><dt>16 oct · 09:30</dt><dd>Alta ficticia del perfil<small>Origen: fixture del laboratorio</small></dd></div></dl><div className="lab-callout"><strong>Notas del laboratorio</strong><p>La misma información permite comparar jerarquía, densidad y materiales entre variantes.</p></div></PanelBody></Panel>
        </div>}
        <footer className="lab-footer lab-muted">A2 · Exploración visual aislada. Ninguna variante está elegida para producto.</footer>
      </main>
    </div>
  );
}
