-- D1: CHECK par_usd_pivote — todo par de cotización debe incluir USD como base o quote
-- Razón: la oficina solo opera pares pivotados a USD (ej: USD/ARS, USD/BRL, USD/GBP).
-- Esto evita pares como EUR/ARS que romperían la agregación y el cálculo de spread.
ALTER TABLE "par"
    ADD CONSTRAINT "par_usd_pivote"
    CHECK ("base" = 'USD' OR "quote" = 'USD');
