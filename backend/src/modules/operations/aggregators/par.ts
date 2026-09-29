// =============================================================
// Aggregators by Par — agrupación por par (USD/ARS, EUR/ARS, etc.)
//
// Business invariant: dinero siempre como texto decimal canónico.
// TODOS los cálculos usan decimal.js con precision 40, HALF_UP.
// =============================================================

import { Decimal } from 'decimal.js';

export interface ParStats {
  par: string;
  totalCompras: number;    // volumen total en base (quantidad de moneda base)
  totalVentas: number;     // volumen total en base
  compraPromedio: number;  // promedio ponderado por volumen
  ventaPromedio: number;   // promedio ponderado por volumen
  spreadPromedio: number;  // spread promedio
  volumenTotalUsd: number; // volumen equivalente en USD
  nOps: number;
  gananciaEstimadaUsd: number; // ganancia por spread
}

export interface ParAggregationResult {
  stats: ParStats[];
  totalCompras: number;
  totalVentas: number;
  volumenTotalUsd: number;
  gananciaTotalUsd: number;
}

/**
 * Agrega estadísticas por par desde un array de operaciones.
 * Cada operación debe tener: par, tipo (C/V), monto, cotiz, contra, pricingMode, gananciaUsd.
 *
 * Para calcular spread promedio ponderado:
 *   spread = (venta - compra) / compra
 *   ponderado = suma(spread_i * volumen_i) / suma(volumen_i)
 */
export function aggregateByPar(ops: {
  par: string;
  tipo: 'C' | 'V';
  monto: string | number;
  cotiz: string | number;
  contra: string | number;
  pricingMode?: string | null;
  gananciaUsd?: string | number;
}[]): ParAggregationResult {
  const pMap = new Map<string, {
    comprasVol: Decimal;
    comprasSumCotiz: Decimal;
    ventasVol: Decimal;
    ventasSumCotiz: Decimal;
    spreadW: Decimal;
    volumenUsd: Decimal;
    nOps: number;
    gananciaUsd: Decimal;
  }>();

  for (const op of ops) {
    const entry = pMap.get(op.par) ?? {
      comprasVol: new Decimal(0),
      comprasSumCotiz: new Decimal(0),
      ventasVol: new Decimal(0),
      ventasSumCotiz: new Decimal(0),
      spreadW: new Decimal(0),
      volumenUsd: new Decimal(0),
      nOps: 0,
      gananciaUsd: new Decimal(0),
    };

    const monto = new Decimal(op.monto);
    const cotiz = new Decimal(op.cotiz);

    if (op.tipo === 'C') {
      entry.comprasVol = entry.comprasVol.plus(monto);
      entry.comprasSumCotiz = entry.comprasSumCotiz.plus(monto.times(cotiz));
      // spread aproximado como (contra/monto - 1) si pricingMode != precio_amigo
      if (op.pricingMode !== 'precio_amigo') {
        const contra = new Decimal(op.contra);
        const rate = contra.div(monto);
        // spread = rate - 1 (aproximación)
        const spread = rate.minus(1);
        entry.spreadW = entry.spreadW.plus(spread.times(monto));
      }
    } else {
      entry.ventasVol = entry.ventasVol.plus(monto);
      entry.ventasSumCotiz = entry.ventasSumCotiz.plus(monto.times(cotiz));
    }

    const contra = new Decimal(op.contra);
    entry.volumenUsd = entry.volumenUsd.plus(contra);
    entry.nOps += 1;

    if (op.gananciaUsd != null) {
      entry.gananciaUsd = entry.gananciaUsd.plus(op.gananciaUsd);
    }

    pMap.set(op.par, entry);
  }

  const stats: ParStats[] = [];
  let totalCompras = new Decimal(0);
  let totalVentas = new Decimal(0);
  let totalVolumenUsd = new Decimal(0);
  let totalGananciaUsd = new Decimal(0);

  for (const [par, data] of pMap.entries()) {
    const compraPromedio = data.comprasVol.isZero()
      ? 0
      : data.comprasSumCotiz.div(data.comprasVol).toNumber();
    const ventaPromedio = data.ventasVol.isZero()
      ? 0
      : data.ventasSumCotiz.div(data.ventasVol).toNumber();
    const spreadPromedio = data.comprasVol.isZero()
      ? 0
      : data.spreadW.div(data.comprasVol).toNumber();

    stats.push({
      par,
      totalCompras: data.comprasVol.toNumber(),
      totalVentas: data.ventasVol.toNumber(),
      compraPromedio,
      ventaPromedio,
      spreadPromedio,
      volumenTotalUsd: data.volumenUsd.toNumber(),
      nOps: data.nOps,
      gananciaEstimadaUsd: data.gananciaUsd.toNumber(),
    });

    totalCompras = totalCompras.plus(data.comprasVol);
    totalVentas = totalVentas.plus(data.ventasVol);
    totalVolumenUsd = totalVolumenUsd.plus(data.volumenUsd);
    totalGananciaUsd = totalGananciaUsd.plus(data.gananciaUsd);
  }

  return {
    stats,
    totalCompras: totalCompras.toNumber(),
    totalVentas: totalVentas.toNumber(),
    volumenTotalUsd: totalVolumenUsd.toNumber(),
    gananciaTotalUsd: totalGananciaUsd.toNumber(),
  };
}
