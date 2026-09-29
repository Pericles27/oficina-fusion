'use client';

import { useState, useMemo } from 'react';
import { TrendingUp, Edit2, Save, X, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { SearchBar } from '@/components/ui';

interface Pair {
  id: string; pair: string; buy: number; sell: number;
  spread: number; variation: number; lastUpdate: string;
}

const initialPairs: Pair[] = [
  { id: 'USD-ARS', pair: 'USD / ARS', buy: 1048, sell: 1052, spread: 4, variation: -2, lastUpdate: '14:32' },
  { id: 'EUR-ARS', pair: 'EUR / ARS', buy: 1138, sell: 1144, spread: 6, variation: 1.5, lastUpdate: '14:30' },
  { id: 'GBP-ARS', pair: 'GBP / ARS', buy: 1325, sell: 1332, spread: 7, variation: -0.8, lastUpdate: '14:28' },
  { id: 'USDT-ARS', pair: 'USDT / ARS', buy: 1046, sell: 1050, spread: 4, variation: -1, lastUpdate: '14:32' },
  { id: 'BRL-ARS', pair: 'BRL / ARS', buy: 189, sell: 193, spread: 4, variation: 0.3, lastUpdate: '14:25' },
];

export default function QuotationPage() {
  const [pairs, setPairs] = useState(initialPairs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? pairs.filter((p) => p.pair.toLowerCase().includes(q)) : pairs;
  }, [pairs, search]);

  const startEdit = (p: Pair) => { setEditingId(p.id); setEditValue(String(p.buy)); };
  const cancelEdit = () => { setEditingId(null); setEditValue(''); };

  const saveEdit = () => {
    const rate = parseFloat(editValue);
    if (!editingId || Number.isNaN(rate)) return;
    setPairs((prev) => prev.map((p) =>
      p.id === editingId ? { ...p, buy: rate, sell: rate + p.spread } : p
    ));
    cancelEdit();
  };

  const refresh = () => {
    setPairs((prev) => prev.map((p) => ({
      ...p,
      buy: p.buy + Math.round((Math.random() - 0.5) * 4),
      lastUpdate: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    })));
  };

  return (
    <div className="page animate-in">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1>Cotizaciones</h1>
          <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>
            Tasas de cambio del día
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={refresh}>
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </header>

      <SearchBar placeholder="Buscar par de divisas..." value={search} onChange={setSearch} />

      <section className="grid-3">
        {filtered.map((p) => {
          const editing = editingId === p.id;
          return (
            <article key={p.id} className="card p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="grid place-items-center w-9 h-9 shrink-0"
                        style={{
                          borderRadius: 'var(--radius-xs)',
                          background: 'var(--blue-subtle)',
                          color: 'var(--blue)',
                        }}>
                    <TrendingUp className="w-[18px] h-[18px]" />
                  </span>
                  <h3 className="heading-3 truncate">{p.pair}</h3>
                </div>
                <span className="badge badge-neutral tabular">{p.lastUpdate}</span>
              </div>

              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    className="input"
                    type="number"
                    inputMode="decimal"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                  />
                  <button className="btn btn-icon" onClick={saveEdit} aria-label="Guardar"
                          style={{ color: 'var(--success)' }}>
                    <Save className="w-[18px] h-[18px]" />
                  </button>
                  <button className="btn btn-icon" onClick={cancelEdit} aria-label="Cancelar">
                    <X className="w-[18px] h-[18px]" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="caption flex items-center gap-1" style={{ color: 'var(--warm-gray-3)' }}>
                        <ArrowDownRight className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
                        Compra
                      </span>
                      <p className="m-0 mt-0.5 text-[21px] font-bold currency" style={{ color: 'var(--success)' }}>
                        {p.buy.toLocaleString('es-AR')}
                      </p>
                    </div>
                    <div>
                      <span className="caption flex items-center gap-1" style={{ color: 'var(--warm-gray-3)' }}>
                        <ArrowUpRight className="w-3.5 h-3.5" style={{ color: 'var(--blue)' }} />
                        Venta
                      </span>
                      <p className="m-0 mt-0.5 text-[21px] font-bold currency" style={{ color: 'var(--blue)' }}>
                        {p.sell.toLocaleString('es-AR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3"
                       style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="text-small">
                      <span style={{ color: 'var(--warm-gray-3)' }}>Spread </span>
                      <span className="tabular font-medium">{p.spread}</span>
                    </span>
                    <span className="text-small font-semibold tabular"
                          style={{ color: p.variation >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {p.variation >= 0 ? '+' : ''}{p.variation}%
                    </span>
                  </div>

                  <button className="btn btn-secondary btn-sm btn-full" onClick={() => startEdit(p)}>
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar tasa
                  </button>
                </>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
