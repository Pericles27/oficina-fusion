import { describe, it, expect } from 'vitest';
import { aggregateByPar, cotizMonedaAUsd, monedasSinCotizacion, type ParDefInput, type ParOpInput, type ParComisionInput } from './par';
import { D } from '../../../common/decimal';

const pares: ParDefInput[] = [
  { par: 'USD/ARS', base: 'USD', quote: 'ARS', compra: '1000', venta: '1010' },
  { par: 'EUR/USD', base: 'EUR', quote: 'USD', compra: '1.08', venta: '1.09' },
];

describe('aggregateByPar — B2: ganancia = spread − comisiones', () => {
  it('sin operaciones devuelve todo en cero', () => {
    const r = aggregateByPar([], [], pares);
    expect(r.stats).toEqual([]);
    expect([r.spreadUsd, r.comisionesUsd, r.gananciaUsd, r.volumenUsd]).toEqual(['0', '0', '0', '0']);
  });

  /**
   * Paridad dígito a dígito con Admin_caja. Valores esperados obtenidos
   * ejecutando el `aggregatePar` original de
   * Admin_caja/apps/api/src/modules/closing/aggregators/par.ts sobre este
   * mismo fixture (tcCierre = 0 → ARS con la venta de USD/ARS), 2026-10-19.
   */
  it('paridad con Admin_caja sobre un set de dos pares con comisiones en quote y en USD', () => {
    const ops: ParOpInput[] = [
      { id: 'o1', par: 'USD/ARS', tipo: 'C', monto: '100', cotiz: '1000', contra: '100000' },
      { id: 'o2', par: 'USD/ARS', tipo: 'C', monto: '50', cotiz: '1005', contra: '50250' },
      { id: 'o3', par: 'USD/ARS', tipo: 'V', monto: '120', cotiz: '1012.5', contra: '121500' },
      { id: 'o4', par: 'USD/ARS', tipo: 'V', monto: '7.3333', cotiz: '1011.123456', contra: '7414.9416' },
      { id: 'o5', par: 'EUR/USD', tipo: 'C', monto: '200', cotiz: '1.07', contra: '214' },
      { id: 'o6', par: 'EUR/USD', tipo: 'V', monto: '150', cotiz: '1.0925', contra: '163.875' },
    ];
    const comisiones: ParComisionInput[] = [
      { opId: 'o1', monto: '500', moneda: 'quote' },
      { opId: 'o3', monto: '3', moneda: 'USD' },
      { opId: 'o5', monto: '0.5', moneda: 'quote' },
    ];
    const r = aggregateByPar(ops, comisiones, pares);
    const pick = (par: string) => {
      const s = r.stats.find((x) => x.par === par)!;
      return [s.promCompra, s.promVenta, s.spread, s.matchedBase, s.realizedQuote, s.spreadUsd, s.comisionesUsd, s.volumenUsd];
    };
    expect(pick('USD/ARS')).toEqual(['1001.666667', '1012.421272', '10.754606', '127.3333', '1369.4194', '1.36', '3.5', '276.4']);
    expect(pick('EUR/USD')).toEqual(['1.07', '1.0925', '0.0225', '150', '3.375', '3.38', '0.5', '377.88']);
  });

  it('caso de la demo: compra y venta calzadas a distinto precio y sin comisión → ganancia ≠ 0 e igual al spread', () => {
    const r = aggregateByPar([
      { id: 'c', par: 'USD/ARS', tipo: 'C', monto: '1000', cotiz: '1000', contra: '1000000' },
      { id: 'v', par: 'USD/ARS', tipo: 'V', monto: '1000', cotiz: '1010', contra: '1010000' },
    ], [], pares);
    // 1000 USD × 10 ARS = 10000 ARS; ÷ 1010 = 9.90 USD
    expect(r.stats[0].realizedQuote).toBe('10000');
    expect(r.gananciaUsd).toBe('9.9');
    expect(r.gananciaUsd).toBe(r.spreadUsd);
    expect(r.comisionesUsd).toBe('0');
  });

  it('con comisión en USD → gananciaUsd = spreadUsd − comisionesUsd exacto', () => {
    const r = aggregateByPar([
      { id: 'c', par: 'USD/ARS', tipo: 'C', monto: '1000', cotiz: '1000', contra: '1000000' },
      { id: 'v', par: 'USD/ARS', tipo: 'V', monto: '1000', cotiz: '1010', contra: '1010000' },
    ], [{ opId: 'v', monto: '2.5', moneda: 'USD' }], pares);
    expect(r.spreadUsd).toBe('9.9');
    expect(r.comisionesUsd).toBe('2.5');
    expect(D(r.gananciaUsd).eq(D(r.spreadUsd).minus(r.comisionesUsd))).toBe(true);
    expect(r.gananciaUsd).toBe('7.4');
  });

  it('con comisión en moneda quote → se convierte a USD antes de restar', () => {
    const r = aggregateByPar([
      { id: 'c', par: 'USD/ARS', tipo: 'C', monto: '1000', cotiz: '1000', contra: '1000000' },
      { id: 'v', par: 'USD/ARS', tipo: 'V', monto: '1000', cotiz: '1010', contra: '1010000' },
    ], [{ opId: 'v', monto: '2020', moneda: 'quote' }], pares);
    // 2020 ARS ÷ 1010 = 2 USD (no 2020 USD)
    expect(r.comisionesUsd).toBe('2');
    expect(r.gananciaUsd).toBe('7.9');
  });

  it('una comisión de una operación ausente (p. ej. cancelada y filtrada) no cuenta', () => {
    const r = aggregateByPar([
      { id: 'c', par: 'USD/ARS', tipo: 'C', monto: '1000', cotiz: '1000', contra: '1000000' },
      { id: 'v', par: 'USD/ARS', tipo: 'V', monto: '1000', cotiz: '1010', contra: '1010000' },
    ], [{ opId: 'cancelada', monto: '5', moneda: 'USD' }], pares);
    expect(r.comisionesUsd).toBe('0');
  });

  it('sin volumen calzado (sólo compras) el spread realizado es 0', () => {
    const r = aggregateByPar([{ id: 'c', par: 'USD/ARS', tipo: 'C', monto: '10', cotiz: '1000', contra: '10000' }], [], pares);
    expect(r.stats[0].matchedBase).toBe('0');
    expect(r.spreadUsd).toBe('0');
  });

  it('par sin definición → error explícito, nunca un 0 inventado', () => {
    expect(() => aggregateByPar([{ id: 'x', par: 'USD/XYZ', tipo: 'C', monto: '1', cotiz: '1', contra: '1' }], [], pares)).toThrow(/sin definición/);
  });

  it('cotizMonedaAUsd: ARS usa 1/tcCierre y, sin TC, 1/venta de USD/ARS', () => {
    expect(cotizMonedaAUsd('ARS', pares, D(1250)).eq(D(1).div(1250))).toBe(true);
    expect(cotizMonedaAUsd('ARS', pares).eq(D(1).div(1010))).toBe(true);
    expect(cotizMonedaAUsd('USDT', pares).eq(1)).toBe(true);
  });

  it('quote de un par USD/X sin X/USD → 1/venta de USD/X', () => {
    const conBrl: ParDefInput[] = [...pares, { par: 'USD/BRL', base: 'USD', quote: 'BRL', compra: '5', venta: '5.1' }];
    expect(cotizMonedaAUsd('BRL', conBrl).eq(D(1).div('5.1'))).toBe(true);
  });

  it('monedasSinCotizacion detecta una quote sin ningún par contra USD', () => {
    const sinRef: ParDefInput[] = [{ par: 'USD/BRL', base: 'USD', quote: 'BRL', compra: '5', venta: '0' }];
    expect(monedasSinCotizacion([{ id: 'b', par: 'USD/BRL', tipo: 'C', monto: '1', cotiz: '5', contra: '5' }], sinRef)).toEqual(['BRL']);
  });
});
