-- U3-bis (Nicolás, 2026-10-19): la cuenta bancaria del cliente tiene moneda,
-- obligatoria, ARS o USD, en un campo aparte del tipo de cuenta.
-- Aditiva: la columna admite NULL sólo para filas previas a esta migración;
-- la API exige el valor en toda alta. El tramo guarda la copia (snapshot).
ALTER TABLE "cuenta_cliente"
    ADD COLUMN "monedaCuenta" "Moneda",
    ADD CONSTRAINT "cuenta_cliente_moneda_ars_usd"
        CHECK ("monedaCuenta" IS NULL OR "monedaCuenta" IN ('ARS', 'USD'));

ALTER TABLE "eticket_tramo"
    ADD COLUMN "depMonedaCuenta" "Moneda",
    ADD CONSTRAINT "eticket_tramo_dep_moneda_ars_usd"
        CHECK ("depMonedaCuenta" IS NULL OR "depMonedaCuenta" IN ('ARS', 'USD'));
