-- #12: saldos reales del cierre, en USD, varios renglones por moneda.
-- Aditivo: no toca columnas existentes de "cierre".

-- CreateTable
CREATE TABLE "cierre_saldo_real" (
    "id" TEXT NOT NULL,
    "cierreId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "montoUsd" DECIMAL(18,2) NOT NULL,
    "detalle" TEXT,

    CONSTRAINT "cierre_saldo_real_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cierre_saldo_real_monto_usd_no_negativo" CHECK ("montoUsd" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "cierre_saldo_real_cierreId_orden_key" ON "cierre_saldo_real"("cierreId", "orden");

-- AddForeignKey
ALTER TABLE "cierre_saldo_real" ADD CONSTRAINT "cierre_saldo_real_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
