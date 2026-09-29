-- AlterTable: Add unique constraint on Eticket.operationId
CREATE UNIQUE INDEX "eticket_operationId_key" ON "eticket"("operationId");

-- AlterTable: Add monedaEntregar and monedaRecibir columns
ALTER TABLE "eticket" ADD COLUMN "monedaEntregar" "Moneda";
ALTER TABLE "eticket" ADD COLUMN "monedaRecibir" "Moneda";

-- Update triggers: fix reopen (Caso B)
-- operacion
CREATE OR REPLACE FUNCTION "operacion_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Caso A: ligar al cierre (confirm).
        IF OLD."cierreId" IS NULL THEN
            RETURN NEW;
        END IF;
        -- Caso B: desligar del cierre (reopen). Solo si NO cambia nada financiero.
        IF NEW."cierreId" IS NULL THEN
            IF NEW."monto"  IS DISTINCT FROM OLD."monto"
            OR NEW."cotiz"  IS DISTINCT FROM OLD."cotiz"
            OR NEW."contra" IS DISTINCT FROM OLD."contra"
            OR NEW."tipo"   IS DISTINCT FROM OLD."tipo" THEN
                RAISE EXCEPTION
                    'reopen solo puede desligar la operacion %, no editarla', OLD."id";
            END IF;
            RETURN NEW;
        END IF;
        -- Caso C: ligada y sigue ligada.
        RAISE EXCEPTION 'operacion % es inmutable (ligada al cierre %)',
            OLD."id", OLD."cierreId";
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION
                'operacion % es inmutable (ligada al cierre %): no se puede borrar',
                OLD."id", OLD."cierreId";
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- comision
CREATE OR REPLACE FUNCTION "comision_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."cierreId" IS NULL THEN RETURN NEW; END IF;
        IF NEW."cierreId" IS NULL THEN
            IF NEW."monto"  IS DISTINCT FROM OLD."monto"
            OR NEW."moneda" IS DISTINCT FROM OLD."moneda" THEN
                RAISE EXCEPTION
                    'reopen solo puede desligar la comision %, no editarla', OLD."id";
            END IF;
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'comision % es inmutable (ligada al cierre %)',
            OLD."id", OLD."cierreId";
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION 'comision % es inmutable: no se puede borrar', OLD."id";
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- gasto
CREATE OR REPLACE FUNCTION "gasto_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."cierreId" IS NULL THEN RETURN NEW; END IF;
        IF NEW."cierreId" IS NULL THEN
            IF NEW."monto"     IS DISTINCT FROM OLD."monto"
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

-- usdt_movimiento
CREATE OR REPLACE FUNCTION "usdt_movimiento_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."cierreId" IS NULL THEN RETURN NEW; END IF;
        IF NEW."cierreId" IS NULL THEN
            IF NEW."monto" IS DISTINCT FROM OLD."monto"
            OR NEW."tipo"  IS DISTINCT FROM OLD."tipo" THEN
                RAISE EXCEPTION
                    'reopen solo puede desligar el movimiento usdt %, no editarlo', OLD."id";
            END IF;
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'usdt_movimiento % es inmutable (ligado al cierre %)',
            OLD."id", OLD."cierreId";
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION 'usdt_movimiento % es inmutable: no se puede borrar', OLD."id";
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
