'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, SearchBar, Input } from '@/components/ui';
import { DollarSign, TrendingUp, Edit2, Save, X, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface QuotationPair {
  id: string;
  pair: string;
  buy: number;
  sell: number;
  spread: number;
  variation: number;
  lastUpdate: string;
}

const mockPairs: QuotationPair[] = [
  { id: 'USD-ARS', pair: 'USD / ARS', buy: 1048, sell: 1052, spread: 4, variation: -2, lastUpdate: '14:32' },
  { id: 'EUR-ARS', pair: 'EUR / ARS', buy: 1138, sell: 1144, spread: 6, variation: +1.5, lastUpdate: '14:30' },
  { id: 'GBP-ARS', pair: 'GBP / ARS', buy: 1325, sell: 1332, spread: 7, variation: -0.8, lastUpdate: '14:28' },
  { id: 'USDT-ARS', pair: 'USDT / ARS', buy: 1046, sell: 1050, spread: 4, variation: -1, lastUpdate: '14:32' },
  { id: 'USDC-ARS', pair: 'USDC / ARS', buy: 1047, sell: 1051, spread: 4, variation: -1, lastUpdate: '14:31' },
  { id: 'BRL-ARS', pair: 'BRL / ARS', buy: 189, sell: 193, spread: 4, variation: +0.3, lastUpdate: '14:25' },
];

export default function QuotationPage() {
  const [pairs, setPairs] = useState(mockPairs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [search, setSearch] = useState('');

  const startEdit = (pair: QuotationPair) => {
    setEditingId(pair.id);
    setEditValue(pair.buy.toString());
  };

  const saveEdit = () => {
    if (!editingId) return;
    const newRate = parseFloat(editValue);
    if (isNaN(newRate)) return;
    setPairs((prev) =>
      prev.map((p) =>
        p.id === editingId
          ? { ...p, buy: newRate, sell: newRate + p.spread }
          : p
      )
    );
    setEditingId(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const refreshRates = () => {
    setPairs((prev) =>
      prev.map((p) => ({
        ...p,
        buy: p.buy + Math.round((Math.random() - 0.5) * 4),
        lastUpdate: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      }))
    );
  };

  const filtered = pairs.filter((p) => p.pair.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--warm-gray-1)]">Cotizaciones</h1>
          <p className="text-sm text-[var(--warm-gray-2)] mt-1">Tasas de cambio del día</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshRates}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
          <button className="btn-primary flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Nueva Cotización
          </button>
        </div>
      </div>

      {/* Search */}
      <SearchBar placeholder="Buscar par de divisas..." value={search} onChange={setSearch} />

      {/* Pair Cards Grid */}
      <div className="grid grid-3 gap-4">
        {filtered.map((pair) => (
          <Card
            key={pair.id}
            className="rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)] hover:shadow-md transition-shadow cursor-pointer"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--blue)]/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[var(--blue)]" />
                </div>
                <CardTitle className="text-base font-semibold text-[var(--warm-gray-1)]">
                  {pair.pair}
                </CardTitle>
              </div>
              <Badge variant="neutral" className="text-xs">
                {pair.lastUpdate}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-3">
              {editingId === pair.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1"
                  />
                  <button
                    onClick={saveEdit}
                    className="btn-icon p-2 rounded-lg bg-[var(--success)] text-white cursor-pointer hover:bg-[var(--success)]/80 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="btn-icon p-2 rounded-lg bg-[var(--warm-gray-4)] text-[var(--warm-gray-2)] cursor-pointer hover:bg-[var(--warm-gray-5)] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <ArrowDownRight className="w-3.5 h-3.5 text-[var(--success)]" />
                        <span className="text-xs text-[var(--warm-gray-2)]">Compra</span>
                      </div>
                      <p className="text-xl font-bold text-[var(--success)]">{pair.buy.toLocaleString('es-AR')}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <ArrowUpRight className="w-3.5 h-3.5 text-[var(--blue)]" />
                        <span className="text-xs text-[var(--warm-gray-2)]">Venta</span>
                      </div>
                      <p className="text-xl font-bold text-[var(--blue)]">{pair.sell.toLocaleString('es-AR')}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--warm-gray-5)]">
                    <div>
                      <span className="text-xs text-[var(--warm-gray-2)]">Spread</span>
                      <p className="text-sm font-medium text-[var(--warm-gray-1)]">{pair.spread}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-medium ${pair.variation >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {pair.variation >= 0 ? '+' : ''}{pair.variation}%
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Edit Button (when not editing) */}
              {editingId !== pair.id && (
                <button
                  onClick={() => startEdit(pair)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--warm-gray-4)]/50 hover:bg-[var(--warm-gray-4)] transition-colors text-sm text-[var(--warm-gray-2)] cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar Tasa
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Reference */}
      <Card className="rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[var(--blue)]" />
            Referencia Rápida
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--warm-gray-5)]">
                  <th className="text-left px-4 py-2 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Par</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Compra</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Venta</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Spread</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Variación</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Hora</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pair) => (
                  <tr
                    key={pair.id}
                    className="border-b border-[var(--warm-gray-5)] last:border-0 hover:bg-[var(--warm-gray-4)]/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-[var(--warm-gray-1)]">{pair.pair}</td>
                    <td className="px-4 py-3 text-sm text-right text-[var(--success)] font-medium">{pair.buy.toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 text-sm text-right text-[var(--blue)] font-medium">{pair.sell.toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 text-sm text-right text-[var(--warm-gray-2)]">{pair.spread}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${pair.variation >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                      {pair.variation >= 0 ? '+' : ''}{pair.variation}%
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-[var(--warm-gray-2)]">{pair.lastUpdate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}