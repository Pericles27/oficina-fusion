// =============================================================
// Aggregators by Operador — agrupación por operador
// =============================================================

import { Decimal } from 'decimal.js';

export interface OperadorStats {
  operadorId: string;
  operadorNombre: string;
  nOps: number;
  totalCompras: number;
  totalVentas: number;
  volumenTotalUsd: number;
  gananciaUsd: number;
  comisionesUsd: number;
}

export interface OperadorAggregationResult {
  stats: OperadorStats[];
  nOpsTotal: number;
  volumenTotalUsd: number;
  gananciaTotalUsd: number;
}

export function aggregateByOperador(ops: {
  operadorId: string;
  operadorNombre: string;
  tipo: 'C' | 'V';
  contra: string | number;
  gananciaUsd?: string | number;
  comisionUsd?: string | number;
}[]): OperadorAggregationResult {
  const map = new Map<string, {
    id: string;
    nombre: string;
    nOps: number;
    compras: number;
    ventas: number;
    volumenUsd: Decimal;
    gananciaUsd: Decimal;
    comisionesUsd: Decimal;
  }>();

  for (const op of ops) {
    const entry = map.get(op.operadorId) ?? {
      id: op.operadorId,
      nombre: op.operadorNombre,
      nOps: 0,
      compras: 0,
      ventas: 0,
      volumenUsd: new Decimal(0),
      gananciaUsd: new Decimal(0),
      comisionesUsd: new Decimal(0),
    };

    entry.nOps++;
    if (op.tipo === 'C') entry.compras++;
    else entry.ventas++;

    entry.volumenUsd = entry.volumenUsd.plus(new Decimal(op.contra));
    if (op.gananciaUsd != null) {
      entry.gananciaUsd = entry.gananciaUsd.plus(new Decimal(op.gananciaUsd));
    }
    if (op.comisionUsd != null) {
      entry.comisionesUsd = entry.comisionesUsd.plus(new Decimal(op.comisionUsd));
    }

    map.set(op.operadorId, entry);
  }

  const stats: OperadorStats[] = [];
  let totalOps = 0;
  let totalVolumenUsd = new Decimal(0);
  let totalGananciaUsd = new Decimal(0);

  for (const [, d] of map.entries()) {
    stats.push({
      operadorId: d.id,
      operadorNombre: d.nombre,
      nOps: d.nOps,
      totalCompras: d.compras,
      totalVentas: d.ventas,
      volumenTotalUsd: d.volumenUsd.toNumber(),
      gananciaUsd: d.gananciaUsd.toNumber(),
      comisionesUsd: d.comisionesUsd.toNumber(),
    });
    totalOps += d.nOps;
    totalVolumenUsd = totalVolumenUsd.plus(d.volumenUsd);
    totalGananciaUsd = totalGananciaUsd.plus(d.gananciaUsd);
  }

  return {
    stats,
    nOpsTotal: totalOps,
    volumenTotalUsd: totalVolumenUsd.toNumber(),
    gananciaTotalUsd: totalGananciaUsd.toNumber(),
  };
}
