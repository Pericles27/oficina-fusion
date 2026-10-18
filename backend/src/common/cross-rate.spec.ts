// =============================================================
// cross-rate.spec.ts — Tests unitarios de crossRate
//
// Vitest puro: sin setupFiles, sin .env, sin DB.
// Ejecutar: backend/node_modules/.bin/vitest run
//   --config vitest-inline.ts cross-rate.spec.ts
// =============================================================

import { describe, it, expect } from 'vitest';
import { crossRate } from './cross-rate';
import { Decimal } from 'decimal.js';

// ------------------------------------------------------------------
// Helper para comparar Decimal
// ------------------------------------------------------------------

function eq(a: Decimal, b: Decimal): boolean {
  return a.eq(b);
}

function stringCanónico(d: Decimal): string {
  return d.toFixed();
}

// ==================================================================
// Test 1 — ARS → EUR con USD como pivote (resultado EXACTO 0.00075)
// ==================================================================
describe('crossRate', () => {
  it('ARS → EUR con USD/ARS=1200 y USD/EUR=0.9 => 0.00075 exacto', () => {
    // Configuración: ambos pares con USD como base
    // USD/ARS = 1200  → 1 USD = 1200 ARS
    // USD/EUR = 0.9   → 1 USD = 0.9 EUR
    // Cruzada: ARS → EUR = (0.9 / 1200) = 0.00075
    const pairs = [
      { par: 'USD/ARS', tasa: '1200' },
      { par: 'USD/EUR', tasa: '0.9' },
    ];

    const resultado = crossRate('ARS', 'EUR', pairs);
    const esperado = new Decimal('0.00075');

    expect(eq(resultado, esperado)).toBe(true);
    expect(stringCanónico(resultado)).toBe('0.00075');
  });

  // ==================================================================
  // Test 2 — Moneda sin par USD → error explícito
  // ==================================================================
  it('moneda sin par USD lanza Error explícito', () => {
    const pairs = [
      { par: 'USD/ARS', tasa: '1200' },
      { par: 'USD/EUR', tasa: '0.9' },
    ];

    expect(() => crossRate('GBP', 'EUR', pairs)).toThrow(
      'crossRate: moneda "GBP" no tiene par con USD en el catálogo',
    );
  });

  // ==================================================================
  // Test 3 — X → X (misma moneda) retorna 1
  // ==================================================================
  it('X → X retorna Decimal(1)', () => {
    const pairs = [
      { par: 'USD/ARS', tasa: '1200' },
    ];

    const resultado = crossRate('ARS', 'ARS', pairs);
    expect(eq(resultado, new Decimal(1))).toBe(true);
    expect(stringCanónico(resultado)).toBe('1');
  });

  // ==================================================================
  // Extras: USD directo, inversa, orientación, tasa inválida
  // ==================================================================

  it('USD → ARS directo retorna tasa del par USD/ARS', () => {
    const pairs = [
      { par: 'USD/ARS', tasa: '1200' },
    ];
    const resultado = crossRate('USD', 'ARS', pairs);
    expect(eq(resultado, new Decimal('1200'))).toBe(true);
  });

  it('USD/EUR con inversión (EUR/USD → 0.9) calcula USD→EUR inverso', () => {
    // Par dado como EUR/USD con tasa 0.9 → 1 EUR = 0.9 USD
    // USD→EUR debe ser 1/0.9
    const pairs = [
      { par: 'EUR/USD', tasa: '0.9' },
    ];
    const resultado = crossRate('USD', 'EUR', pairs);
    const esperado = new Decimal(1).div(new Decimal('0.9'));
    expect(eq(resultado, esperado)).toBe(true);
  });

  it('ARS → USD con par USD/ARS=1200 retorna 1/1200', () => {
    const pairs = [
      { par: 'USD/ARS', tasa: '1200' },
    ];
    const resultado = crossRate('ARS', 'USD', pairs);
    const esperado = new Decimal(1).div(new Decimal('1200'));
    // Decimal.eq verifica igualdad matemática exacta
    expect(eq(resultado, esperado)).toBe(true);
    // toFixed() con precision=30 produce 33 decimales fijos
    expect(stringCanónico(resultado)).toBe('0.000833333333333333333333333333333');
  });

  it('tasa inválida (<=0) lanza Error', () => {
    const pairs = [
      { par: 'USD/ARS', tasa: '0' },
      { par: 'USD/EUR', tasa: '0.9' },
    ];

    expect(() => crossRate('ARS', 'EUR', pairs)).toThrow(
      'crossRate: tasa inválida para USD/ARS: 0 (debe ser > 0)',
    );

    // También tasa negativa
    const pairsNeg = [
      { par: 'USD/ARS', tasa: '-5' },
      { par: 'USD/EUR', tasa: '0.9' },
    ];
    expect(() => crossRate('ARS', 'EUR', pairsNeg)).toThrow(
      'crossRate: tasa inválida para USD/ARS: -5 (debe ser > 0)',
    );
  });

  // === Pruebas adversariales (D2 R1) ===

  it('tasa "NaN" lanza Error (no numérica)', () => {
    const pairs = [
      { par: 'USD/ARS', tasa: 'NaN' },
      { par: 'USD/EUR', tasa: '0.9' },
    ];
    expect(() => crossRate('USD', 'ARS', pairs)).toThrow(
      'crossRate: tasa no numérica para USD/ARS',
    );
  });

  it('tasa "Infinity" lanza Error (no finita)', () => {
    const pairs = [
      { par: 'USD/ARS', tasa: 'Infinity' },
      { par: 'USD/EUR', tasa: '0.9' },
    ];
    expect(() => crossRate('USD', 'ARS', pairs)).toThrow(
      'crossRate: tasa no finita para USD/ARS',
    );
  });

  it('par malformado "USD/ARS/EXTRA" lanza Error (más de 2 componentes)', () => {
    const pairs = [
      { par: 'USD/ARS/EXTRA', tasa: '1200' },
      { par: 'USD/EUR', tasa: '0.9' },
    ];
    expect(() => crossRate('USD', 'ARS', pairs)).toThrow(
      'crossRate: par malformado "USD/ARS/EXTRA" — se requieren exactamente 2 monedas separadas por \'/',
    );
  });

  it('par sin USD lanza Error (ej. EUR/GBP)', () => {
    const pairs = [
      { par: 'EUR/GBP', tasa: '0.85' },
    ];
    expect(() => crossRate('EUR', 'GBP', pairs)).toThrow(
      'crossRate: par "EUR/GBP" no contiene USD — se exige pivote USD',
    );
  });

  it('GBP → JPY con USD/GDP=1.27 y USD/JPY=148 => cruzada', () => {
    // USD/GBP = 1.27 (1 USD = 1.27 GBP)
    // USD/JPY = 148 (1 USD = 148 JPY)
    // GBP→JPY = 148 / 1.27 = 116.535433070866...
    const pairs = [
      { par: 'USD/GBP', tasa: '1.27' },
      { par: 'USD/JPY', tasa: '148' },
    ];
    const resultado = crossRate('GBP', 'JPY', pairs);
    const esperado = new Decimal('148').div(new Decimal('1.27'));
    expect(eq(resultado, esperado)).toBe(true);
  });
});
