// =============================================================
// cross-rate.ts — Tasa de cambio cruzada con USD como pivote
//
// Función pura: crossRate(desde, hacia, pares)
//
// Invariantes:
//   - USD SIEMPRE pivote (regla D1: par_usd_pivote CHECK).
//   - Dinero/tasas como string decimal → cálculo 100% Decimal
//     con precisión 30 y HALF_EVEN (coherencia con common/decimal.ts).
//   - Retorno: Decimal (tipo explícito documentado abajo).
//   - Nunca usa Number en cálculo.
//   - No lee de DB, no endpoints, no registro.
//
// API tipada:
//   - desde/hacia: código de moneda (string mayúscula, ej. 'ARS', 'EUR')
//   - pares:     { par: string; tasa: string }[], cada par en formato
//                "BASE/QUOTE" donde BASE o QUOTE es 'USD'.
//                La "tasa" es el valor unitario 1 BASE → QUOTE (una
//                sola tasa por par, sin distinción compra/venta —
//                caller elige cuál pasar si hay múltiples cotizaciones).
//
// Retorno: Decimal  (ej. crossRate('ARS','EUR',pares) → Decimal('0.00075'))
//
// Casos de uso:
//   1) X === Y       → Decimal(1)
//   2) desde === USD  → encuentra USD/HACIA y retorna tasa directa
//   3) hacia  === USD → encuentra DESDE/USD directa o inversa según forma
//   4) niuno === USD  → cruzada: DESDO→USD→HACIA
//
// Errores explícitos (lanza Error):
//   - moneda sin par USD en el catálogo
//   - tasa <= 0 en cualquier par
// =============================================================

import { Decimal } from 'decimal.js';

// La configuración de precisión/redondeo se aplica una vez en
// common/decimal.ts (precision: 30, ROUND_HALF_EVEN).
// Aquí importamos y reutilizamos sin reconfigurar.
import './decimal';

// ------------------------------------------------------------------
// Tipos públicos
// ------------------------------------------------------------------

/** Formato de un par de cotización tal como llega al caller. */
export interface CrossRatePair {
  /** Identificador canónico del par, ej. "USD/ARS", "USD/EUR" */
  par: string;
  /** Tasa unitaria como string decimal canónico.
   *  Significado: 1 BASE = tasa QUOTE
   *  (el caller elige si es compra, venta o promedio;
   *   esta función NO hace política comercial). */
  tasa: string;
}

// ------------------------------------------------------------------
// Helpers privados
// ------------------------------------------------------------------

/** Resultado interno de buscarParUsd. */
interface UsdRate {
  par: string;
  /** Tasa: 1 base = X USD */
  tasa: Decimal;
}

/**
 * Busca un par que contiene USD y retorna la tasa expresada
 * como "1 moneda = X USD" (o "1 USD = X moneda" cuando la moneda
 * es USD).
 *
 * Los pares pueden estar registrados como "USD/MONEDA" o
 * "MONEDA/USD". La tasa de cada par siempre significa
 * "1 BASE = tasa QUOTE".
 */
function buscarParUsd(
  pairs: ReadonlyArray<{ par: string; tasa: Decimal }>,
  moneda: string,
): UsdRate | null {
  for (const p of pairs) {
    const [pBase, pQuote] = p.par.split('/');

    // Par: USD/MONEDA  →  1 USD = T MONEDA
    // Necesitamos: 1 MONEDA = 1/T USD
    if (pBase === 'USD' && pQuote === moneda) {
      return { par: p.par, tasa: new Decimal(1).div(p.tasa) };
    }

    // Par: MONEDA/USD  →  1 MONEDA = T USD  ← directo
    if (pBase === moneda && pQuote === 'USD') {
      return { par: p.par, tasa: p.tasa };
    }
  }
  return null;
}

// ------------------------------------------------------------------
// Función pública
// ------------------------------------------------------------------

/**
 * Calcula la tasa de cambio cruzada entre dos monedas usando USD
 * como pivote único.
 *
 * @param desde  - moneda origen (ej. 'ARS')
 * @param hacia  - moneda destino (ej. 'EUR')
 * @param pairs  - catálogo de pares disponibles con su tasa
 * @returns       - Decimal con el factor multiplicador
 */
export function crossRate(
  desde: string,
  hacia: string,
  pairs: ReadonlyArray<CrossRatePair>,
): Decimal {
  const desdeTrim = desde.trim().toUpperCase();
  const haciaTrim = hacia.trim().toUpperCase();

  // Caso 1: misma moneda → 1 exacto
  if (desdeTrim === haciaTrim) {
    return new Decimal(1);
  }

  // Normalizar pares, validar tasa y par
  const normalizados: Array<{ par: string; tasa: Decimal }> = [];

  for (const p of pairs) {
    const parTrim = p.par.trim().toUpperCase();
    const tasaTrim = p.tasa.trim();

    // Validar par: exactamente 2 componentes separados por '/'
    const partes = parTrim.split('/');
    if (partes.length !== 2) {
      throw new Error(
        `crossRate: par malformado "${p.par}" — se requieren exactamente 2 monedas separadas por '/'`,
      );
    }
    const [pBase, pQuote] = partes;
    if (!pBase || !pQuote) {
      throw new Error(
        `crossRate: par malformado "${p.par}" — componentes vacíos`,
      );
    }

    // Validar que USD esté presente en uno de los lados
    if (pBase !== 'USD' && pQuote !== 'USD') {
      throw new Error(
        `crossRate: par "${parTrim}" no contiene USD — se exige pivote USD`,
      );
    }

    // Parsear tasa y validar que sea número finito > 0
    const tasaDec = new Decimal(tasaTrim);
    if (tasaDec.isNaN()) {
      throw new Error(
        `crossRate: tasa no numérica para ${parTrim}: "${p.tasa}"`,
      );
    }
    if (!tasaDec.isFinite()) {
      throw new Error(
        `crossRate: tasa no finita para ${parTrim}: "${p.tasa}" — se requiere número finito`,
      );
    }
    if (tasaDec.lte(0)) {
      throw new Error(
        `crossRate: tasa inválida para ${parTrim}: ${tasaDec.toString()} (debe ser > 0)`,
      );
    }

    normalizados.push({ par: parTrim, tasa: tasaDec });
  }

  // Caso 2: desde === USD (tasa directa USD→hacia)
  if (desdeTrim === 'USD') {
    // Necesitamos USD→hacia: 1 USD = X hacia
    for (const p of normalizados) {
      const [pBase, pQuote] = p.par.split('/');
      if (pBase === 'USD' && pQuote === haciaTrim) {
        // 1 USD = T HACIA → directo
        return p.tasa;
      }
      if (pBase === haciaTrim && pQuote === 'USD') {
        // 1 HACIA = T USD → invertir: 1 USD = 1/T HACIA
        return new Decimal(1).div(p.tasa);
      }
    }
    throw new Error(
      `crossRate: no se encontró par USD→${haciaTrim} en el catálogo`,
    );
  }

  // Caso 3: hacia === USD (desde→USD, directa o inversa según forma)
  if (haciaTrim === 'USD') {
    for (const p of normalizados) {
      const [pBase, pQuote] = p.par.split('/');
      if (pBase === desdeTrim && pQuote === 'USD') {
        // 1 desde = T USD → directo
        return p.tasa;
      }
      if (pBase === 'USD' && pQuote === desdeTrim) {
        // 1 USD = T desde → invertir: 1 desde = 1/T USD
        return new Decimal(1).div(p.tasa);
      }
    }
    throw new Error(
      `crossRate: no se encontró par ${desdeTrim}→USD en el catálogo`,
    );
  }

  // Caso 4: cruzada con pivote USD
  // buscarParUsd devuelve "1 moneda = X USD" para cada moneda.
  // rateDesdeUsd = cuántos USD por 1 desde   (ej. 1 ARS = 0.000833 USD)
  // rateHaciaUsd = cuántos USD por 1 hacia    (ej. 1 EUR = 1.111 USD)
  //
  // Queremos: 1 desde = ? hacia
  // 1 desde = rateDesdeUsd USD
  // 1 USD = 1/rateHaciaUsd hacia  (si 1 hacia = rateHaciaUsd USD)
  // Por tanto: 1 desde = rateDesdeUsd / rateHaciaUsd hacia

  const desdeUsd = buscarParUsd(normalizados, desdeTrim);
  const haciaUsd = buscarParUsd(normalizados, haciaTrim);

  if (!desdeUsd) {
    throw new Error(
      `crossRate: moneda "${desdeTrim}" no tiene par con USD en el catálogo`,
    );
  }
  if (!haciaUsd) {
    throw new Error(
      `crossRate: moneda "${haciaTrim}" no tiene par con USD en el catálogo`,
    );
  }

  const factor = desdeUsd.tasa.div(haciaUsd.tasa);

  if (factor.lte(0)) {
    throw new Error(
      `crossRate: resultado no positivo en cruzada ${desdeTrim}→${haciaTrim}`,
    );
  }

  return factor;
}
