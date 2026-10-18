-- C1 is additive: preserve existing account identifiers and Eticket.operationId.
CREATE TYPE "TipoCuenta" AS ENUM ('CAJA_AHORRO', 'CUENTA_CORRIENTE');
CREATE TYPE "TramoSentido" AS ENUM ('ENTREGA', 'RETIRO');
CREATE TYPE "TramoCanal" AS ENUM ('EFECTIVO', 'DEPOSITO');

ALTER TABLE "cuenta_cliente"
    ADD COLUMN "tipoCuenta" "TipoCuenta",
    ADD COLUMN "numeroCuenta" TEXT,
    ADD COLUMN "cbu" TEXT,
    ADD COLUMN "alias" TEXT,
    ADD COLUMN "cuitTitular" TEXT,
    ADD CONSTRAINT "cuenta_cliente_cbu_digits"
        CHECK ("cbu" IS NULL OR "cbu" ~ '^[0-9]{22}$');

CREATE TABLE "eticket_tramo" (
    "id" TEXT NOT NULL,
    "eticketId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "sentido" "TramoSentido" NOT NULL,
    "canal" "TramoCanal" NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "monto" DECIMAL(18,4) NOT NULL,
    "cuentaDestinoId" TEXT,
    "depBeneficiario" TEXT,
    "depCuit" TEXT,
    "depBanco" TEXT,
    "depNumeroCuenta" TEXT,
    "depCbu" TEXT,
    "depAlias" TEXT,
    "depTipoCuenta" "TipoCuenta",
    CONSTRAINT "eticket_tramo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "eticket_tramo_monto_positive" CHECK ("monto" > 0),
    CONSTRAINT "eticket_tramo_dep_cbu_digits"
        CHECK ("depCbu" IS NULL OR "depCbu" ~ '^[0-9]{22}$'),
    CONSTRAINT "eticket_tramo_efectivo_no_deps" CHECK (
        "canal" <> 'EFECTIVO' OR (
            "cuentaDestinoId" IS NULL AND
            "depBeneficiario" IS NULL AND "depCuit" IS NULL AND
            "depBanco" IS NULL AND "depNumeroCuenta" IS NULL AND
            "depCbu" IS NULL AND "depAlias" IS NULL AND "depTipoCuenta" IS NULL
        )
    ),
    -- U6 (DEPOSITO/RETIRO) remains a future service decision, not a DB rule.
    CONSTRAINT "eticket_tramo_deposito_entrega_needs_identifier" CHECK (
        "canal" <> 'DEPOSITO' OR "sentido" <> 'ENTREGA' OR
        "depCbu" IS NOT NULL OR "depNumeroCuenta" IS NOT NULL OR "depAlias" IS NOT NULL
    )
);

CREATE UNIQUE INDEX "eticket_tramo_eticketId_orden_key" ON "eticket_tramo"("eticketId", "orden");
CREATE INDEX "eticket_tramo_eticketId_idx" ON "eticket_tramo"("eticketId");
ALTER TABLE "eticket_tramo" ADD CONSTRAINT "eticket_tramo_eticketId_fkey"
    FOREIGN KEY ("eticketId") REFERENCES "eticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eticket_tramo" ADD CONSTRAINT "eticket_tramo_cuentaDestinoId_fkey"
    FOREIGN KEY ("cuentaDestinoId") REFERENCES "cuenta_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
