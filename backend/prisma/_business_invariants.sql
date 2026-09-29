-- =============================================================
-- Invariantes de negocio (CHECK constraints + triggers)
-- que Prisma no modela en schema.prisma.
-- Se aplican DESPUÉS del baseline generado por Prisma.
-- =============================================================

-- ---- cable_movimiento: monto siempre positivo ----
ALTER TABLE "cable_movimiento"
    ADD CONSTRAINT "cable_movimiento_monto_positivo" CHECK ("monto" > 0);

-- ---- comision: XOR exacto entre opId y cableId ----
ALTER TABLE "comision"
    ADD CONSTRAINT "comision_op_xor_cable" CHECK (
        ("opId" IS NOT NULL AND "cableId" IS NULL)
        OR
        ("opId" IS NULL AND "cableId" IS NOT NULL)
    );

-- ---- cable: exigir 1 ingreso + 1 salida cuando no está pendiente ----
CREATE OR REPLACE FUNCTION "cable_dos_patas_check"()
RETURNS TRIGGER AS $$
DECLARE
    n_ingreso INT;
    n_salida  INT;
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        SELECT COUNT(*) INTO n_ingreso
            FROM "cable_movimiento"
            WHERE "cableId" = NEW."id" AND "lado" = 'ingreso';
        SELECT COUNT(*) INTO n_salida
            FROM "cable_movimiento"
            WHERE "cableId" = NEW."id" AND "lado" = 'salida';

        IF NEW."status" <> 'pendiente' AND (n_ingreso <> 1 OR n_salida <> 1) THEN
            RAISE EXCEPTION
                'Cable % requiere exactamente 1 ingreso y 1 salida (encontrados: ingreso=%, salida=%)',
                NEW."id", n_ingreso, n_salida;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "cable_dos_patas_trigger"
    AFTER INSERT OR UPDATE ON "cable"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION "cable_dos_patas_check"();

-- ---- cliente_saldo_movimiento: XOR de origen (opId / cableId / manual) ----
ALTER TABLE "cliente_saldo_movimiento"
    ADD CONSTRAINT "cliente_saldo_mov_origen_unico" CHECK (
        (CASE WHEN "opId"    IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN "cableId" IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN "manual"  IS TRUE     THEN 1 ELSE 0 END)
      = 1
    );

-- ---- cliente_saldo_movimiento: signo consistente con tipo, nunca 0 ----
ALTER TABLE "cliente_saldo_movimiento"
    ADD CONSTRAINT "cliente_saldo_mov_signo" CHECK (
        ("tipo" = 'debito'  AND "montoUsd" < 0)
        OR
        ("tipo" = 'credito' AND "montoUsd" > 0)
    );

-- ========================================================================
-- TRIGGERS DE INMUTABILIDAD POST-CIERRE
-- ========================================================================

-- ---- cliente_saldo_movimiento: inmutabilidad post-cierre ----
CREATE OR REPLACE FUNCTION "cliente_saldo_mov_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            IF NEW."cierreId" IS DISTINCT FROM OLD."cierreId"
               OR NEW."montoUsd"     IS DISTINCT FROM OLD."montoUsd"
               OR NEW."tipo"         IS DISTINCT FROM OLD."tipo"
               OR NEW."clienteId"    IS DISTINCT FROM OLD."clienteId"
               OR NEW."opId"         IS DISTINCT FROM OLD."opId"
               OR NEW."cableId"      IS DISTINCT FROM OLD."cableId"
               OR NEW."saldoPostUsd" IS DISTINCT FROM OLD."saldoPostUsd" THEN
                RAISE EXCEPTION
                    'cliente_saldo_movimiento % es inmutable (ligado al cierre %)',
                    OLD."id", OLD."cierreId";
            END IF;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION
                'cliente_saldo_movimiento % es inmutable (ligado al cierre %): emitir compensación en su lugar',
                OLD."id", OLD."cierreId";
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cliente_saldo_mov_inmutable_trigger"
    BEFORE UPDATE OR DELETE ON "cliente_saldo_movimiento"
    FOR EACH ROW
    EXECUTE FUNCTION "cliente_saldo_mov_inmutable"();

-- ---- operacion: inmutabilidad post-cierre (permite setear cierreId la primera vez) ----
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

CREATE TRIGGER "operacion_inmutable_trigger"
    BEFORE UPDATE OR DELETE ON "operacion"
    FOR EACH ROW
    EXECUTE FUNCTION "operacion_inmutable"();

-- ---- cotizacion_snapshot: histórico inmutable, nunca se edita ni se borra ----
CREATE OR REPLACE FUNCTION "cotizacion_snapshot_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'cotizacion_snapshot % es inmutable (histórico de mercado)', OLD."id";
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'cotizacion_snapshot % no se puede borrar (histórico de mercado)', OLD."id";
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cotizacion_snapshot_inmutable_trigger"
    BEFORE UPDATE OR DELETE ON "cotizacion_snapshot"
    FOR EACH ROW
    EXECUTE FUNCTION "cotizacion_snapshot_inmutable"();

-- ---- cierre: inmutabilidad post-confirmación (no se puede editar ni borrar cuando confirmado) ----
CREATE OR REPLACE FUNCTION "cierre_inmutable_post_confirmado"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."estado" = 'confirmado' THEN
            -- Permitir SOLO el cambio de confirmado → reabierto (reopen)
            IF NEW."estado" = 'reabierto' THEN
                RETURN NEW;
            END IF;
            -- Bloquear cualquier otro cambio
            RAISE EXCEPTION
                'cierre % está confirmado y no se puede editar (usar /reopen para reabrirlo)',
                OLD."id";
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."estado" = 'confirmado' THEN
            RAISE EXCEPTION
                'cierre % está confirmado y no se puede borrar',
                OLD."id";
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cierre_inmutable_trigger"
    BEFORE UPDATE OR DELETE ON "cierre"
    FOR EACH ROW
    EXECUTE FUNCTION "cierre_inmutable_post_confirmado"();

-- ---- cable: inmutabilidad post-cierre (análogo a operacion) ----
CREATE OR REPLACE FUNCTION "cable_inmutable_post_cierre"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            IF NEW."cierreId"         IS DISTINCT FROM OLD."cierreId"
               OR NEW."montoIngresoUsd"  IS DISTINCT FROM OLD."montoIngresoUsd"
               OR NEW."montoSalidaUsd"   IS DISTINCT FROM OLD."montoSalidaUsd"
               OR NEW."diferenciaUsd"    IS DISTINCT FROM OLD."diferenciaUsd"
               OR NEW."comisionUsd"      IS DISTINCT FROM OLD."comisionUsd"
               OR NEW."gananciaNetaUsd"  IS DISTINCT FROM OLD."gananciaNetaUsd" THEN
                RAISE EXCEPTION
                    'cable % es inmutable (ligado al cierre %)',
                    OLD."id", OLD."cierreId";
            END IF;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION
                'cable % es inmutable (ligado al cierre %): no se puede borrar',
                OLD."id", OLD."cierreId";
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cable_inmutable_trigger"
    BEFORE UPDATE OR DELETE ON "cable"
    FOR EACH ROW
    EXECUTE FUNCTION "cable_inmutable_post_cierre"();

-- ---- comision: inmutabilidad post-cierre (análogo a operacion) ----
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

CREATE TRIGGER "comision_inmutable_trigger"
    BEFORE UPDATE OR DELETE ON "comision"
    FOR EACH ROW
    EXECUTE FUNCTION "comision_inmutable"();

-- ---- gasto: inmutabilidad post-cierre (análogo a operacion) ----
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

CREATE TRIGGER "gasto_inmutable_trigger"
    BEFORE UPDATE OR DELETE ON "gasto"
    FOR EACH ROW
    EXECUTE FUNCTION "gasto_inmutable"();

-- ---- usdt_movimiento: inmutabilidad post-cierre (análogo a operacion) ----
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

CREATE TRIGGER "usdt_movimiento_inmutable_trigger"
    BEFORE UPDATE OR DELETE ON "usdt_movimiento"
    FOR EACH ROW
    EXECUTE FUNCTION "usdt_movimiento_inmutable"();
