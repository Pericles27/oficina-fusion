-- #17: pares Libra y Real en la mesa. Ambos pivotan en USD (CHECK par_usd_pivote).
--   GBP/USD: dólares por libra (como EUR/USD).
--   USD/BRL: reales por dólar (convención de mercado).
-- Cotizaciones de REFERENCIA, a actualizar en Cotizaciones antes de operar.
-- ON CONFLICT: si el par ya existe no se toca su cotización.
INSERT INTO "par" ("par", "base", "quote", "nombre", "compra", "venta", "varPct", "decimals") VALUES
    ('GBP/USD', 'GBP', 'USD', 'Libra', 1.2600, 1.2800, 0, 4),
    ('USD/BRL', 'USD', 'BRL', 'Real',  5.3000, 5.4500, 0, 2)
ON CONFLICT ("par") DO NOTHING;
