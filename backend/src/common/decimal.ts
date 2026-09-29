import { Decimal } from "decimal.js";

/**
 * Wrapper sobre decimal.js con la precisión y modo de redondeo que usa
 * la mesa: banker's rounding (ROUND_HALF_EVEN) por convención de
 * estados financieros.
 */
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_EVEN });

export type Dec = Decimal;
export const D = (v: Decimal.Value): Dec => new Decimal(v);
export const D0 = D(0);

export function sum(values: ReadonlyArray<Decimal.Value>): Dec {
  return values.reduce<Dec>((acc, v) => acc.plus(v), D0);
}

/** Redondeo de display a N decimales devolviendo Decimal. */
export function round(value: Decimal.Value, dp: number): Dec {
  return D(value).toDecimalPlaces(dp);
}

/** Round a 2 decimales (totales USD/ARS). */
export const round2 = (v: Decimal.Value): Dec => round(v, 2);
/** Round a 4 decimales (cantidades base/quote). */
export const round4 = (v: Decimal.Value): Dec => round(v, 4);
/** Round a 6 decimales (precios). */
export const round6 = (v: Decimal.Value): Dec => round(v, 6);

export { Decimal };
