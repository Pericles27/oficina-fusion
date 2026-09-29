import { describe, it, expect } from 'vitest';
import { aggregateByOperador } from '../aggregators/operador';

describe('aggregateByOperador', () => {
  it('retorna estructura vacía cuando no hay operaciones', () => {
    const result = aggregateByOperador([]);
    expect(result.stats).toEqual([]);
    expect(result.nOpsTotal).toBe(0);
  });

  it('agrupa operaciones por operador y cuenta compras/ventas', () => {
    const result = aggregateByOperador([
      { operadorId: 'op1', operadorNombre: 'Ana', tipo: 'C', contra: '1000' },
      { operadorId: 'op1', operadorNombre: 'Ana', tipo: 'V', contra: '500' },
      { operadorId: 'op2', operadorNombre: 'Beto', tipo: 'C', contra: '2000' },
    ]);

    expect(result.stats).toHaveLength(2);
    expect(result.nOpsTotal).toBe(3);

    const ana = result.stats.find((s) => s.operadorId === 'op1')!;
    expect(ana.nOps).toBe(2);
    expect(ana.totalCompras).toBe(1);
    expect(ana.totalVentas).toBe(1);
    expect(ana.volumenTotalUsd).toBe(1500);
  });

  it('acumula comisiones y ganancia por operador', () => {
    const result = aggregateByOperador([
      { operadorId: 'op1', operadorNombre: 'Ana', tipo: 'C', contra: '1000', gananciaUsd: '10', comisionUsd: '2' },
      { operadorId: 'op1', operadorNombre: 'Ana', tipo: 'C', contra: '1000', gananciaUsd: '5', comisionUsd: '1' },
    ]);
    const ana = result.stats[0];
    expect(ana.gananciaUsd).toBeCloseTo(15, 5);
    expect(ana.comisionesUsd).toBeCloseTo(3, 5);
    expect(result.gananciaTotalUsd).toBeCloseTo(15, 5);
  });
});
