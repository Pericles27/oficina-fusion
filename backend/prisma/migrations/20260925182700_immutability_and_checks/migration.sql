-- =============================================================
-- Inmutabilidad post-cierre (PL/pgSQL) + CHECK constraints
-- de dominio que Prisma no modela en schema.prisma.
-- Puerto de Admin_caja/_business_invariants.sql y
-- mesa-demo/20260918230500_immutability a PostgreSQL,
-- adaptado a los nombres/columnas del schema de oficina-fusion.
-- =============================================================

-- =============================================================
-- CHECK CONSTRAINTS
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

-- ---- cliente_saldo_movimiento: ORIGEN ÚNICO ----
-- Exactamente uno de opId / cableId / manual está presente (adenda Paquete 1).
ALTER TABLE "cliente_saldo_movimiento"
    ADD CONSTRAINT "cliente_saldo_mov_origen_unico" CHECK (
        (CASE WHEN "opId"    IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN "cableId" IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN "manual"  IS TRUE     THEN 1 ELSE 0 END)
      = 1
    );

-- ---- cliente_saldo_movimiento: SIGNO CONSISTENTE ----
-- débito < 0, crédito > 0, nunca 0 (adenda Paquete 1).
ALTER TABLE "cliente_saldo_movimiento"
    ADD CONSTRAINT "cliente_saldo_mov_signo" CHECK (
        ("tipo" = 'debito'  AND "montoUsd" < 0)
        OR
        ("tipo" = 'credito' AND "montoUsd" > 0)
    );

-- =============================================================
-- TRIGGERS: cable dos patas
-- =============================================================

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

-- =============================================================
-- TRIGGERS DE INMUTABILIDAD POST-CIERRE (8 tablas)
--
-- Patrón común: bloquear UPDATE/DELETE sobre filas cuyo cierreId
-- YA estaba seteado antes del cambio (OLD."cierreId" IS NOT NULL).
-- Excepción: el UPDATE que SETEA cierreId por primera vez (el
-- confirm del cierre ligando las filas) se permite siempre —
-- eso corresponde a OLD."cierreId" IS NULL, así que no dispara.
-- =============================================================

-- ---- 1. operacion ----
CREATE OR REPLACE FUNCTION "operacion_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION
                'operacion % es inmutable (ligada al cierre %)',
                OLD."id", OLD."cierreId";
        END IF;
        RETURN NEW;
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

-- ---- 2. comision ----
CREATE OR REPLACE FUNCTION "comision_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION
                'comision % es inmutable (ligada al cierre %)',
                OLD."id", OLD."cierreId";
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION
                'comision % es inmutable (ligada al cierre %): no se puede borrar',
                OLD."id", OLD."cierreId";
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

-- ---- 3. gasto ----
CREATE OR REPLACE FUNCTION "gasto_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION
                'gasto % es inmutable (ligado al cierre %)',
                OLD."id", OLD."cierreId";
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION
                'gasto % es inmutable (ligado al cierre %): no se puede borrar',
                OLD."id", OLD."cierreId";
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

-- ---- 4. usdt_movimiento ----
CREATE OR REPLACE FUNCTION "usdt_movimiento_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION
                'usdt_movimiento % es inmutable (ligado al cierre %)',
                OLD."id", OLD."cierreId";
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION
                'usdt_movimiento % es inmutable (ligado al cierre %): no se puede borrar',
                OLD."id", OLD."cierreId";
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

-- ---- 5. cable ----
CREATE OR REPLACE FUNCTION "cable_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."cierreId" IS NOT NULL THEN
            RAISE EXCEPTION
                'cable % es inmutable (ligado al cierre %)',
                OLD."id", OLD."cierreId";
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
    EXECUTE FUNCTION "cable_inmutable"();

-- ---- 6. cliente_saldo_movimiento ----
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

-- ---- 7. cotizacion_snapshot ----
-- Histórico: siempre inmutable, sin excepción (no depende de cierreId).
CREATE OR REPLACE FUNCTION "cotizacion_snapshot_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION
            'cotizacion_snapshot % es inmutable (histórico, nunca se edita)',
            OLD."id";
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'cotizacion_snapshot % es inmutable (histórico, nunca se borra)',
            OLD."id";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cotizacion_snapshot_inmutable_trigger"
    BEFORE UPDATE OR DELETE ON "cotizacion_snapshot"
    FOR EACH ROW
    EXECUTE FUNCTION "cotizacion_snapshot_inmutable"();

-- ---- 8. cierre ----
-- Inmutable una vez confirmado, salvo el propio flujo de reopen/reconfirm
-- (que cambia el campo "estado"). Bloquea ediciones de los campos de
-- snapshot financiero una vez que el cierre pasó por "confirmado".
CREATE OR REPLACE FUNCTION "cierre_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."estado" = 'confirmado' THEN
            IF NEW."estado" NOT IN ('reabierto') THEN
                RAISE EXCEPTION
                    'cierre % ya confirmado: solo se permite reabrir (estado=reabierto), no editar sus campos financieros',
                    OLD."id";
            END IF;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."estado" IN ('confirmado', 'reabierto') THEN
            RAISE EXCEPTION
                'cierre % es inmutable (estado=%): no se puede borrar',
                OLD."id", OLD."estado";
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cierre_inmutable_trigger"
    BEFORE UPDATE OR DELETE ON "cierre"
    FOR EACH ROW
    EXECUTE FUNCTION "cierre_inmutable"();
