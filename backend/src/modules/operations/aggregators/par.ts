// =============================================================
// Aggregators by Par — B2: ganancia = spread − comisiones (U1)
//
// Port de Admin_caja (apps/api/src/modules/closing/aggregators/par.ts +
// cotiz.ts, leído con autorización de Nicolás el 2026-10-19). Se mantiene
// la lógica operativa de Admin_caja:
//   promCompra = Σ contra / Σ monto de las compras (quote por unidad de base)
//   promVenta  = ídem ventas
//   spread     = promVenta − promCompra
//   realizado  = min(Σ base comprada, Σ base vendida) × spread   (en quote)
//   spreadUsd  = realizado convertido a USD
// El spread es AGREGADO por par (no por operación): ver D7/U10 del plan.
//
// Dinero siempre como string decimal; cálculo con decimal.js (precisión 30,
// HALF_EVEN, `@common/decimal`) y el mismo redondeo de salida que Admin_caja.
// =============================================================

import { D, D0, round2, round4, round6, type Dec } from '../../../common/decimal';

type Value = string | number;

export interface ParOpInput {
  id: string;
  par: string;
  tipo: 'C' | 'V';
  monto: Value;
  cotiz: Value;
  contra: Value;
}

export interface ParComisionInput {
  opId: string;
  monto: Value;
  /** "quote" del par o "USD" directo (enum ComisionMoneda). */
  moneda: 'quote' | 'USD';
}

export interface ParDefInput {
  par: string;
  base: string;
  quote: string;
  compra: Value;
  venta: Value;
}

export interface ParStats {
  par: string;
  base: string;
  quote: string;
  nOps: number;
  // Compatibilidad con el frontend existente (sólo para mostrar).
  totalCompras: number;
  totalVentas: number;
  compraPromedio: number;
  ventaPromedio: number;
  volumenTotalUsd: number;
  // B2: cifras exactas como string decimal.
  comprasBase: string;
  ventasBase: string;
  promCompra: string;
  promVenta: string;
  /** promVenta − promCompra, en quote por unidad de base. */
  spread: string;
  matchedBase: string;
  /** Resultado por spread sobre el volumen calzado, en quote. */
  realizedQuote: string;
  spreadUsd: string;
  comisionesUsd: string;
  /** spreadUsd − comisionesUsd. */
  gananciaUsd: string;
  volumenUsd: string;
}

export interface ParAggregationResult {
  stats: ParStats[];
  spreadUsd: string;
  comisionesUsd: string;
  gananciaUsd: string;
  volumenUsd: string;
}

/**
 * Cotización de una moneda a USD (port de `cotizMonedaAUsd` de Admin_caja).
 * - USD / USDT → 1
 * - ARS → 1 / tcCierre; sin TC de cierre, 1 / venta de USD/ARS
 * - otra → compra de su par X/USD; si sólo existe USD/X, 1 / venta de USD/X
 * Si no hay cotización, devuelve 0 igual que Admin_caja; `monedasSinCotizacion`
 * permite detectarlo en vez de mostrar un 0 silencioso.
 */
export function cotizMonedaAUsd(moneda: string, pares: ReadonlyArray<ParDefInput>, tcCierre: Dec = D0): Dec {
  if (moneda === 'USD' || moneda === 'USDT') return D(1);
  if (moneda === 'ARS') {
    if (tcCierre.lte(0)) {
      const fallback = pares.find((p) => p.par === 'USD/ARS');
      if (!fallback) return D0;
      return D(1).dividedBy(fallback.venta);
    }
    return D(1).dividedBy(tcCierre);
  }
  const p = pares.find((x) => x.base === moneda && x.quote === 'USD');
  if (p) return D(p.compra);
  // Extensión respecto de Admin_caja: con D1 un par puede ser USD/X (p. ej.
  // USD/BRL). Se aplica la misma regla que Admin_caja usa para ARS sin TC.
  const inverse = pares.find((x) => x.base === 'USD' && x.quote === moneda);
  return inverse && D(inverse.venta).gt(0) ? D(1).dividedBy(inverse.venta) : D0;
}

export function toUsd(valor: Dec, moneda: string, pares: ReadonlyArray<ParDefInput>, tcCierre: Dec = D0): Dec {
  return valor.times(cotizMonedaAUsd(moneda, pares, tcCierre));
}

const sumBy = <T>(arr: ReadonlyArray<T>, f: (x: T) => Dec): Dec =>
  arr.reduce((acc, x) => acc.plus(f(x)), D0);

/**
 * Agrega por par. Las operaciones canceladas NO deben venir en `ops`
 * (el service las filtra); sus comisiones se ignoran porque sólo se suman
 * comisiones de operaciones presentes.
 */
export function aggregateByPar(
  ops: ReadonlyArray<ParOpInput>,
  comisiones: ReadonlyArray<ParComisionInput>,
  pares: ReadonlyArray<ParDefInput>,
  tcCierre: Dec = D0,
): ParAggregationResult {
  const stats: ParStats[] = [];
  const parIds = [...new Set(ops.map((o) => o.par))].sort();

  for (const parId of parIds) {
    const pdef = pares.find((p) => p.par === parId);
    if (!pdef) throw new Error(`Par ${parId} sin definición: no se puede convertir a USD`);
    const parOps = ops.filter((o) => o.par === parId);
    const compras = parOps.filter((o) => o.tipo === 'C');
    const ventas = parOps.filter((o) => o.tipo === 'V');

    const comprasBase = sumBy(compras, (o) => D(o.monto));
    const comprasQuote = sumBy(compras, (o) => D(o.contra));
    const ventasBase = sumBy(ventas, (o) => D(o.monto));
    const ventasQuote = sumBy(ventas, (o) => D(o.contra));

    const promCompra = comprasBase.gt(0) ? comprasQuote.div(comprasBase) : D0;
    const promVenta = ventasBase.gt(0) ? ventasQuote.div(ventasBase) : D0;
    const spread = promVenta.minus(promCompra);

    const matchedBase = comprasBase.lt(ventasBase) ? comprasBase : ventasBase;
    const realizedQuote = matchedBase.times(spread);
    const realizedUsd = toUsd(realizedQuote, pdef.quote, pares, tcCierre);

    const volumenQuote = comprasQuote.plus(ventasQuote);
    const volumenUsd = toUsd(volumenQuote, pdef.quote, pares, tcCierre);

    const opIds = new Set(parOps.map((o) => o.id));
    const comisionesUsd = comisiones
      .filter((c) => opIds.has(c.opId))
      .reduce<Dec>((acc, c) => (c.moneda === 'USD'
        ? acc.plus(c.monto)
        : acc.plus(toUsd(D(c.monto), pdef.quote, pares, tcCierre))), D0);

    const spreadUsd = round2(realizedUsd);
    const comisiones2 = round2(comisionesUsd);
    stats.push({
      par: parId,
      base: pdef.base,
      quote: pdef.quote,
      nOps: parOps.length,
      totalCompras: comprasBase.toNumber(),
      totalVentas: ventasBase.toNumber(),
      compraPromedio: promCompra.toNumber(),
      ventaPromedio: promVenta.toNumber(),
      volumenTotalUsd: round2(volumenUsd).toNumber(),
      comprasBase: round4(comprasBase).toString(),
      ventasBase: round4(ventasBase).toString(),
      promCompra: round6(promCompra).toString(),
      promVenta: round6(promVenta).toString(),
      spread: round6(spread).toString(),
      matchedBase: round4(matchedBase).toString(),
      realizedQuote: round4(realizedQuote).toString(),
      spreadUsd: spreadUsd.toString(),
      comisionesUsd: comisiones2.toString(),
      gananciaUsd: spreadUsd.minus(comisiones2).toString(),
      volumenUsd: round2(volumenUsd).toString(),
    });
  }

  const total = (k: 'spreadUsd' | 'comisionesUsd' | 'gananciaUsd' | 'volumenUsd') =>
    stats.reduce<Dec>((acc, s) => acc.plus(s[k]), D0).toString();
  return {
    stats,
    spreadUsd: total('spreadUsd'),
    comisionesUsd: total('comisionesUsd'),
    gananciaUsd: total('gananciaUsd'),
    volumenUsd: total('volumenUsd'),
  };
}

/** Monedas quote de los pares operados que no tienen cotización a USD. */
export function monedasSinCotizacion(ops: ReadonlyArray<ParOpInput>, pares: ReadonlyArray<ParDefInput>, tcCierre: Dec = D0): string[] {
  const quotes = new Set(ops.map((o) => pares.find((p) => p.par === o.par)?.quote).filter((q): q is string => !!q));
  return [...quotes].filter((q) => cotizMonedaAUsd(q, pares, tcCierre).isZero()).sort();
}
