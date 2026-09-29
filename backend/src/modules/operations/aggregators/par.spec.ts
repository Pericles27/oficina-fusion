import { describe, it, expect } from 'vitest';
import { aggregateByPar } from '../aggregators/par';

describe('aggregateByPar', () => {
  it('retorna estructura vacía cuando no hay operaciones', () => {
    const result = aggregateByPar([]);
    expect(result.stats).toEqual([]);
    expect(result.totalCompras).toBe(0);
    expect(result.totalVentas).toBe(0);
    expect(result.volumenTotalUsd).toBe(0);
    expect(result.gananciaTotalUsd).toBe(0);
  });

  it('agrega compras y ventas de un mismo par correctamente', () => {
    const result = aggregateByPar([
      { par: 'USD/ARS', tipo: 'C', monto: '100', cotiz: '1000', contra: '100000' },
      { par: 'USD/ARS', tipo: 'V', monto: '50', cotiz: '1010', contra: '50500' },
    ]);

    expect(result.stats).toHaveLength(1);
    const [usdArs] = result.stats;
    expect(usdArs.par).toBe('USD/ARS');
    expect(usdArs.totalCompras).toBe(100);
    expect(usdArs.totalVentas).toBe(50);
    expect(usdArs.nOps).toBe(2);
    expect(usdArs.compraPromedio).toBe(1000);
    expect(usdArs.ventaPromedio).toBe(1010);
    expect(result.volumenTotalUsd).toBe(150500);
  });

  it('separa correctamente múltiples pares', () => {
    const result = aggregateByPar([
      { par: 'USD/ARS', tipo: 'C', monto: '100', cotiz: '1000', contra: '100000' },
      { par: 'EUR/ARS', tipo: 'C', monto: '10', cotiz: '1100', contra: '11000' },
    ]);

    expect(result.stats).toHaveLength(2);
    const pares = result.stats.map((s) => s.par).sort();
    expect(pares).toEqual(['EUR/ARS', 'USD/ARS']);
  });

  it('calcula spread ponderado por volumen en compras (excluye precio_amigo)', () => {
    const result = aggregateByPar([
      // rate = contra/monto = 1050/100 = 10.5 => spread = 9.5 (aprox, ver fórmula real)
      { par: 'USD/ARS', tipo: 'C', monto: '100', cotiz: '1000', contra: '105000', pricingMode: 'standard' },
    ]);
    const [usdArs] = result.stats;
    // rate = 105000/100 = 1050; spread = rate - 1 = 1049
    expect(usdArs.spreadPromedio).toBeCloseTo(1049, 5);
  });

  it('ignora el spread cuando pricingMode es precio_amigo', () => {
    const result = aggregateByPar([
      { par: 'USD/ARS', tipo: 'C', monto: '100', cotiz: '1000', contra: '100000', pricingMode: 'precio_amigo' },
    ]);
    const [usdArs] = result.stats;
    expect(usdArs.spreadPromedio).toBe(0);
  });

  it('acumula gananciaEstimadaUsd desde gananciaUsd de cada operación', () => {
    const result = aggregateByPar([
      { par: 'USD/ARS', tipo: 'C', monto: '100', cotiz: '1000', contra: '100000', gananciaUsd: '5.5' },
      { par: 'USD/ARS', tipo: 'V', monto: '50', cotiz: '1010', contra: '50500', gananciaUsd: '2.25' },
    ]);
    expect(result.gananciaTotalUsd).toBeCloseTo(7.75, 5);
    expect(result.stats[0].gananciaEstimadaUsd).toBeCloseTo(7.75, 5);
  });

  it('maneja montos numéricos (no solo strings)', () => {
    const result = aggregateByPar([
      { par: 'USD/ARS', tipo: 'C', monto: 100, cotiz: 1000, contra: 100000 },
    ]);
    expect(result.stats[0].totalCompras).toBe(100);
  });

  it('no divide por cero cuando solo hay ventas (compraPromedio = 0)', () => {
    const result = aggregateByPar([
      { par: 'USD/ARS', tipo: 'V', monto: '50', cotiz: '1010', contra: '50500' },
    ]);
    expect(result.stats[0].compraPromedio).toBe(0);
    expect(result.stats[0].spreadPromedio).toBe(0);
  });
});
