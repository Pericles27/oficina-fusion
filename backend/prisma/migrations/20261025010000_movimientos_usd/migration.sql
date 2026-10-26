-- #13: movimientos del día en USD (cables, USDT, gastos de oficina/jefe).
-- Aditivo salvo gasto.monto, que pasa a opcional (legado en ARS).

-- CreateEnum
CREATE TYPE "GastoTipo" AS ENUM ('OFICINA', 'JEFE', 'JEFE_A_DEVOLVER');

-- AlterTable
ALTER TABLE "cierre" ADD COLUMN     "deudaJefeUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "gananciaCablesUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "gananciaUsdtUsd" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "gasto" ADD COLUMN     "montoUsd" DECIMAL(18,2),
ADD COLUMN     "tipo" "GastoTipo" NOT NULL DEFAULT 'OFICINA',
ALTER COLUMN "monto" DROP NOT NULL;

-- CreateTable
CREATE TABLE "usdt_operacion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operadorId" TEXT NOT NULL,
    "montoIngresoUsd" DECIMAL(18,2) NOT NULL,
    "montoEgresoUsd" DECIMAL(18,2) NOT NULL,
    "comisionUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gananciaNetaUsd" DECIMAL(18,2) NOT NULL,
    "notas" TEXT,
    "cierreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usdt_operacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usdt_operacion_codigo_key" ON "usdt_operacion"("codigo");

-- CreateIndex
CREATE INDEX "usdt_operacion_cierreId_idx" ON "usdt_operacion"("cierreId");

-- CreateIndex
CREATE INDEX "usdt_operacion_fecha_idx" ON "usdt_operacion"("fecha");

-- AddForeignKey
ALTER TABLE "usdt_operacion" ADD CONSTRAINT "usdt_operacion_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usdt_operacion" ADD CONSTRAINT "usdt_operacion_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierre"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---- gasto: los nuevos se cargan en USD; los viejos conservan su monto en ARS ----
ALTER TABLE "gasto"
    ADD CONSTRAINT "gasto_monto_usd_o_ars" CHECK (
        ("montoUsd" IS NOT NULL AND "montoUsd" > 0)
        OR ("montoUsd" IS NULL AND "monto" IS NOT NULL)
    );

-- ---- usdt_operacion: montos positivos, comisión no negativa ----
ALTER TABLE "usdt_operacion"
    ADD CONSTRAINT "usdt_operacion_montos_validos" CHECK (
        "montoIngresoUsd" > 0 AND "montoEgresoUsd" > 0 AND "comisionUsd" >= 0
    );

-- ---- usdt_operacion: inmutable una vez ligada a un cierre (mismo patrón que gasto) ----
CREATE OR REPLACE FUNCTION "usdt_operacion_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."cierreId" IS NULL THEN RETURN NEW; END IF;
        IF NEW."cierreId" IS NULL THEN
            IF NEW."montoIngresoUsd" IS DISTINCT FROM OLD."montoIngresoUsd"
            OR NEW."montoEgresoUsd"  IS DISTINCT FROM OLD."montoEgresoUsd"
            OR NEW."comisionUsd"     IS DISTINCT FROM OLD."comisionUsd" THEN
                RAISE EXCEPTION
                    'reopen solo puede desligar la operación USDT %, no editarla', OLD."id";
            END IF;
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'operación USDT % es inmutable (ligada al cierre %)',
            OLD."id", OLD."cierreId";
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION 'operación USDT % es inmutable: no se puede borrar', OLD."id";
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "usdt_operacion_inmutable_trigger"
    BEFORE UPDATE OR DELETE ON "usdt_operacion"
    FOR EACH ROW
    EXECUTE FUNCTION "usdt_operacion_inmutable"();

-- ---- gasto_inmutable: el reopen tampoco puede editar los campos nuevos ----
CREATE OR REPLACE FUNCTION "gasto_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."cierreId" IS NULL THEN RETURN NEW; END IF;
        IF NEW."cierreId" IS NULL THEN
            IF NEW."monto"     IS DISTINCT FROM OLD."monto"
            OR NEW."montoUsd"  IS DISTINCT FROM OLD."montoUsd"
            OR NEW."tipo"      IS DISTINCT FROM OLD."tipo"
            OR NEW."categoria" IS DISTINCT FROM OLD."categoria" THEN
                RAISE EXCEPTION
                    'reopen solo puede desligar el gasto %, no editarlo', OLD."id";
            END IF;
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'gasto % es inmutable (ligado al cierre %)',
            OLD."id", OLD."cierreId";
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION 'gasto % es inmutable: no se puede borrar', OLD."id";
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
