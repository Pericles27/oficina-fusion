-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('ARS', 'EUR', 'GBP', 'BRL', 'USD', 'USDT');

-- CreateEnum
CREATE TYPE "OpTipo" AS ENUM ('C', 'V');

-- CreateEnum
CREATE TYPE "OpStatus" AS ENUM ('pendiente', 'en_ejecucion', 'finalizada', 'cancelada');

-- CreateEnum
CREATE TYPE "Cobertura" AS ENUM ('efectivo', 'saldo');

-- CreateEnum
CREATE TYPE "ComisionMoneda" AS ENUM ('quote', 'USD');

-- CreateEnum
CREATE TYPE "GastoCategoria" AS ENUM ('Comida', 'Insumos', 'Transporte', 'Servicios', 'Otros');

-- CreateEnum
CREATE TYPE "UsdtTipo" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "Desk" AS ENUM ('spot', 'fx', 'cripto', 'mesa');

-- CreateEnum
CREATE TYPE "ClienteTipo" AS ENUM ('Persona', 'Empresa');

-- CreateEnum
CREATE TYPE "CierreEstado" AS ENUM ('borrador', 'confirmado', 'reabierto');

-- CreateEnum
CREATE TYPE "CableLado" AS ENUM ('ingreso', 'salida');

-- CreateEnum
CREATE TYPE "ClienteSaldoTipo" AS ENUM ('debito', 'credito');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'CADETE');

-- CreateEnum
CREATE TYPE "EticketEstado" AS ENUM ('pendiente', 'en_curso', 'confirmado', 'cancelado');

-- CreateEnum
CREATE TYPE "TramiteEstado" AS ENUM ('pendiente', 'en_curso', 'completado', 'cancelado');

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "roles" "RolUsuario"[],
    "email" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "bloqueadoHasta" TIMESTAMP(3),
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "primerLogin" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cookie" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "par" (
    "par" TEXT NOT NULL,
    "base" "Moneda" NOT NULL,
    "quote" "Moneda" NOT NULL,
    "nombre" TEXT NOT NULL,
    "compra" DECIMAL(18,6) NOT NULL,
    "venta" DECIMAL(18,6) NOT NULL,
    "varPct" DECIMAL(8,4) NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "par_pkey" PRIMARY KEY ("par")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "alias" TEXT,
    "tipo" "ClienteTipo" NOT NULL,
    "doc" TEXT,
    "saldoUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "custodia" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "puntosHabituales" DECIMAL(18,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_telefono" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cliente_telefono_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_direccion" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "tipo" TEXT,
    "ciudad" TEXT,
    "provincia" TEXT,
    "codigoPost" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cliente_direccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuenta_cliente" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "tipo" TEXT,
    "numero" TEXT NOT NULL,
    "titular" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cuenta_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operacion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tsEjecucion" TIMESTAMP(3),
    "tsFinalizada" TIMESTAMP(3),
    "tipo" "OpTipo" NOT NULL,
    "parId" TEXT NOT NULL,
    "monto" DECIMAL(18,4) NOT NULL,
    "cotiz" DECIMAL(18,6) NOT NULL,
    "contra" DECIMAL(18,4) NOT NULL,
    "cobertura" "Cobertura" NOT NULL,
    "status" "OpStatus" NOT NULL DEFAULT 'pendiente',
    "operadorId" TEXT NOT NULL,
    "clienteId" TEXT,
    "marketRateId" TEXT,
    "clientRate" DECIMAL(18,6) NOT NULL,
    "puntos" DECIMAL(18,6),
    "pricingMode" TEXT,
    "balanceIn" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "balanceOut" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notas" TEXT,
    "cierreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comision" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "opId" TEXT,
    "cableId" TEXT,
    "operadorId" TEXT NOT NULL,
    "monto" DECIMAL(18,4) NOT NULL,
    "moneda" "ComisionMoneda" NOT NULL DEFAULT 'quote',
    "notas" TEXT,
    "cierreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gasto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "categoria" "GastoCategoria" NOT NULL,
    "notas" TEXT,
    "cierreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usdt_movimiento" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "UsdtTipo" NOT NULL,
    "monto" DECIMAL(18,4) NOT NULL,
    "origen" TEXT NOT NULL,
    "notas" TEXT,
    "cierreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usdt_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cable" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tsEjecucion" TIMESTAMP(3),
    "tsFinalizada" TIMESTAMP(3),
    "status" "OpStatus" NOT NULL DEFAULT 'pendiente',
    "operadorId" TEXT NOT NULL,
    "clienteId" TEXT,
    "montoIngresoUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "montoSalidaUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "diferenciaUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "comisionUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gananciaNetaUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notas" TEXT,
    "cierreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cable_movimiento" (
    "id" TEXT NOT NULL,
    "cableId" TEXT NOT NULL,
    "lado" "CableLado" NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'USD',
    "monto" DECIMAL(18,2) NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cable_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_saldo_movimiento" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clienteId" TEXT NOT NULL,
    "tipo" "ClienteSaldoTipo" NOT NULL,
    "montoUsd" DECIMAL(18,2) NOT NULL,
    "saldoPostUsd" DECIMAL(18,2) NOT NULL,
    "opId" TEXT,
    "cableId" TEXT,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "nota" TEXT,
    "cierreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cliente_saldo_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" "CierreEstado" NOT NULL DEFAULT 'borrador',
    "horaApertura" VARCHAR(8),
    "horaCierre" VARCHAR(8),
    "operadorCierreId" TEXT NOT NULL,
    "operadorCierreNombre" TEXT NOT NULL,
    "tcCierre" DECIMAL(18,6) NOT NULL,
    "saldoInicialUsd" DECIMAL(18,2) NOT NULL,
    "cajaContadaUsd" DECIMAL(18,2) NOT NULL,
    "posicionEsperadaUsd" DECIMAL(18,2) NOT NULL,
    "diferenciaUsd" DECIMAL(18,2) NOT NULL,
    "gananciaRealizadaUsd" DECIMAL(18,2) NOT NULL,
    "exposicionAbiertaUsd" DECIMAL(18,2) NOT NULL,
    "netoAbiertoUsd" DECIMAL(18,2) NOT NULL,
    "totalComisionesUsd" DECIMAL(18,2) NOT NULL,
    "totalGastosArs" DECIMAL(18,2) NOT NULL,
    "totalGastosUsd" DECIMAL(18,2) NOT NULL,
    "resultadoOperativoUsd" DECIMAL(18,2) NOT NULL,
    "volumenTotalUsd" DECIMAL(18,2) NOT NULL,
    "nOps" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cierre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre_caja" (
    "cierreId" TEXT NOT NULL,
    "usd100" DECIMAL(18,2) NOT NULL,
    "usdResto" DECIMAL(18,2) NOT NULL,
    "totalArs" DECIMAL(18,2) NOT NULL,
    "totalEur" DECIMAL(18,2) NOT NULL,
    "totalGbp" DECIMAL(18,2) NOT NULL,
    "totalBrl" DECIMAL(18,2) NOT NULL,
    "totalUsdContado" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "cierre_caja_pkey" PRIMARY KEY ("cierreId")
);

-- CreateTable
CREATE TABLE "cierre_saldo_moneda" (
    "id" TEXT NOT NULL,
    "cierreId" TEXT NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "cantidadInicial" DECIMAL(18,4) NOT NULL,
    "cantidadFinal" DECIMAL(18,4) NOT NULL,
    "cotizUsd" DECIMAL(18,6) NOT NULL,
    "usdEquivCierre" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "cierre_saldo_moneda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre_resultado_par" (
    "id" TEXT NOT NULL,
    "cierreId" TEXT NOT NULL,
    "par" TEXT NOT NULL,
    "base" "Moneda" NOT NULL,
    "quote" "Moneda" NOT NULL,
    "nOps" INTEGER NOT NULL,
    "comprasBase" DECIMAL(18,4) NOT NULL,
    "comprasQuote" DECIMAL(18,4) NOT NULL,
    "ventasBase" DECIMAL(18,4) NOT NULL,
    "ventasQuote" DECIMAL(18,4) NOT NULL,
    "promCompra" DECIMAL(18,6) NOT NULL,
    "promVenta" DECIMAL(18,6) NOT NULL,
    "spread" DECIMAL(18,6) NOT NULL,
    "matchedBase" DECIMAL(18,4) NOT NULL,
    "realizedQuote" DECIMAL(18,4) NOT NULL,
    "realizedUsd" DECIMAL(18,2) NOT NULL,
    "openBase" DECIMAL(18,4) NOT NULL,
    "openExecPrice" DECIMAL(18,6) NOT NULL,
    "openUsd" DECIMAL(18,2) NOT NULL,
    "volumenBase" DECIMAL(18,4) NOT NULL,
    "volumenQuote" DECIMAL(18,4) NOT NULL,
    "volumenUsd" DECIMAL(18,2) NOT NULL,
    "comisionesUsd" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "cierre_resultado_par_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre_operador" (
    "id" TEXT NOT NULL,
    "cierreId" TEXT NOT NULL,
    "operadorId" TEXT NOT NULL,
    "operadorInitials" VARCHAR(8) NOT NULL,
    "operadorNombre" TEXT NOT NULL,
    "desk" TEXT NOT NULL,
    "nOps" INTEGER NOT NULL,
    "volumenUsd" DECIMAL(18,2) NOT NULL,
    "comisionesUsd" DECIMAL(18,2) NOT NULL,
    "pendientesComision" INTEGER NOT NULL,
    "spreadMedioUsd" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "cierre_operador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre_saldo_cliente" (
    "id" TEXT NOT NULL,
    "cierreId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "saldoUsdApertura" DECIMAL(18,2) NOT NULL,
    "saldoUsdCierre" DECIMAL(18,2) NOT NULL,
    "deltaUsd" DECIMAL(18,2) NOT NULL,
    "nOpsDia" INTEGER NOT NULL,
    "volumenUsdDia" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "cierre_saldo_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre_gasto_categoria" (
    "id" TEXT NOT NULL,
    "cierreId" TEXT NOT NULL,
    "categoria" "GastoCategoria" NOT NULL,
    "nItems" INTEGER NOT NULL,
    "totalArs" DECIMAL(18,2) NOT NULL,
    "totalUsd" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "cierre_gasto_categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizacion_snapshot" (
    "id" TEXT NOT NULL,
    "parId" TEXT NOT NULL,
    "buyRate" DECIMAL(18,6) NOT NULL,
    "sellRate" DECIMAL(18,6) NOT NULL,
    "fuente" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cotizacion_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eticket" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operationId" TEXT,
    "clienteId" TEXT NOT NULL,
    "estado" "EticketEstado" NOT NULL DEFAULT 'pendiente',
    "metodoEntrega" TEXT NOT NULL,
    "direccionEntrega" TEXT,
    "telefonoContacto" TEXT,
    "nombreRecibe" TEXT,
    "horarioEntrega" TEXT,
    "banco" TEXT,
    "cuentaDeposito" TEXT,
    "instrucciones" TEXT,
    "confirmadoPor" TEXT,
    "confirmadoEn" TIMESTAMP(3),
    "montoEntregar" DECIMAL(18,4),
    "montoRecibir" DECIMAL(18,4),
    "creadoPor" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tramite" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "TramiteEstado" NOT NULL DEFAULT 'pendiente',
    "prioridad" TEXT,
    "fechaLimite" TIMESTAMP(3),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCompletado" TIMESTAMP(3),
    "notas" TEXT,
    "clienteId" TEXT,
    "creadoPor" TEXT NOT NULL,
    "asignadoA" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tramite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reunion" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "lugar" TEXT,
    "tipo" TEXT,
    "creadaPor" TEXT NOT NULL,
    "clienteId" TEXT,
    "asistentes" TEXT[],
    "recurrente" BOOLEAN NOT NULL DEFAULT false,
    "recurrenteFrecuencia" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reunion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "detalles" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_event" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "exitoso" BOOLEAN NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "motivoFallo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_log" (
    "id" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "detalle" TEXT,
    "pila" TEXT,
    "url" TEXT,
    "metodo" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_username_key" ON "usuario"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sesion_cookie_key" ON "sesion"("cookie");

-- CreateIndex
CREATE INDEX "sesion_expiraEn_idx" ON "sesion"("expiraEn");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_telefono_clienteId_numero_key" ON "cliente_telefono"("clienteId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_direccion_clienteId_direccion_key" ON "cliente_direccion"("clienteId", "direccion");

-- CreateIndex
CREATE UNIQUE INDEX "cuenta_cliente_clienteId_numero_key" ON "cuenta_cliente"("clienteId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "operacion_codigo_key" ON "operacion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "operacion_numero_key" ON "operacion"("numero");

-- CreateIndex
CREATE INDEX "operacion_cierreId_idx" ON "operacion"("cierreId");

-- CreateIndex
CREATE INDEX "operacion_operadorId_ts_idx" ON "operacion"("operadorId", "ts");

-- CreateIndex
CREATE INDEX "operacion_parId_ts_idx" ON "operacion"("parId", "ts");

-- CreateIndex
CREATE INDEX "operacion_clienteId_idx" ON "operacion"("clienteId");

-- CreateIndex
CREATE INDEX "operacion_status_idx" ON "operacion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "comision_codigo_key" ON "comision"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "comision_opId_key" ON "comision"("opId");

-- CreateIndex
CREATE UNIQUE INDEX "comision_cableId_key" ON "comision"("cableId");

-- CreateIndex
CREATE INDEX "comision_cierreId_idx" ON "comision"("cierreId");

-- CreateIndex
CREATE INDEX "comision_operadorId_idx" ON "comision"("operadorId");

-- CreateIndex
CREATE UNIQUE INDEX "gasto_codigo_key" ON "gasto"("codigo");

-- CreateIndex
CREATE INDEX "gasto_cierreId_idx" ON "gasto"("cierreId");

-- CreateIndex
CREATE INDEX "gasto_fecha_idx" ON "gasto"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "usdt_movimiento_codigo_key" ON "usdt_movimiento"("codigo");

-- CreateIndex
CREATE INDEX "usdt_movimiento_cierreId_idx" ON "usdt_movimiento"("cierreId");

-- CreateIndex
CREATE UNIQUE INDEX "cable_codigo_key" ON "cable"("codigo");

-- CreateIndex
CREATE INDEX "cable_cierreId_idx" ON "cable"("cierreId");

-- CreateIndex
CREATE INDEX "cable_operadorId_ts_idx" ON "cable"("operadorId", "ts");

-- CreateIndex
CREATE INDEX "cable_clienteId_idx" ON "cable"("clienteId");

-- CreateIndex
CREATE INDEX "cable_movimiento_cableId_idx" ON "cable_movimiento"("cableId");

-- CreateIndex
CREATE UNIQUE INDEX "cable_movimiento_cableId_lado_key" ON "cable_movimiento"("cableId", "lado");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_saldo_movimiento_codigo_key" ON "cliente_saldo_movimiento"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_saldo_movimiento_opId_key" ON "cliente_saldo_movimiento"("opId");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_saldo_movimiento_cableId_key" ON "cliente_saldo_movimiento"("cableId");

-- CreateIndex
CREATE INDEX "cliente_saldo_movimiento_clienteId_ts_idx" ON "cliente_saldo_movimiento"("clienteId", "ts");

-- CreateIndex
CREATE INDEX "cliente_saldo_movimiento_cierreId_idx" ON "cliente_saldo_movimiento"("cierreId");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_fecha_key" ON "cierre"("fecha");

-- CreateIndex
CREATE INDEX "cierre_fecha_idx" ON "cierre"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_saldo_moneda_cierreId_moneda_key" ON "cierre_saldo_moneda"("cierreId", "moneda");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_resultado_par_cierreId_par_key" ON "cierre_resultado_par"("cierreId", "par");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_operador_cierreId_operadorId_key" ON "cierre_operador"("cierreId", "operadorId");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_saldo_cliente_cierreId_clienteId_key" ON "cierre_saldo_cliente"("cierreId", "clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_gasto_categoria_cierreId_categoria_key" ON "cierre_gasto_categoria"("cierreId", "categoria");

-- CreateIndex
CREATE INDEX "cotizacion_snapshot_creadoEn_idx" ON "cotizacion_snapshot"("creadoEn");

-- CreateIndex
CREATE INDEX "cotizacion_snapshot_parId_creadoEn_idx" ON "cotizacion_snapshot"("parId", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "eticket_numero_key" ON "eticket"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "eticket_codigo_key" ON "eticket"("codigo");

-- CreateIndex
CREATE INDEX "eticket_estado_idx" ON "eticket"("estado");

-- CreateIndex
CREATE INDEX "eticket_clienteId_idx" ON "eticket"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "tramite_codigo_key" ON "tramite"("codigo");

-- CreateIndex
CREATE INDEX "tramite_estado_idx" ON "tramite"("estado");

-- CreateIndex
CREATE INDEX "tramite_asignadoA_idx" ON "tramite"("asignadoA");

-- CreateIndex
CREATE INDEX "tramite_fechaLimite_idx" ON "tramite"("fechaLimite");

-- CreateIndex
CREATE INDEX "reunion_inicio_idx" ON "reunion"("inicio");

-- CreateIndex
CREATE INDEX "reunion_clienteId_idx" ON "reunion"("clienteId");

-- CreateIndex
CREATE INDEX "audit_event_accion_idx" ON "audit_event"("accion");

-- CreateIndex
CREATE INDEX "audit_event_creadoEn_idx" ON "audit_event"("creadoEn");

-- CreateIndex
CREATE INDEX "audit_event_entidad_entidadId_idx" ON "audit_event"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "login_event_creadoEn_idx" ON "login_event"("creadoEn");

-- CreateIndex
CREATE INDEX "error_log_creadoEn_idx" ON "error_log"("creadoEn");

-- AddForeignKey
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_telefono" ADD CONSTRAINT "cliente_telefono_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_direccion" ADD CONSTRAINT "cliente_direccion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_cliente" ADD CONSTRAINT "cuenta_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacion" ADD CONSTRAINT "operacion_parId_fkey" FOREIGN KEY ("parId") REFERENCES "par"("par") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacion" ADD CONSTRAINT "operacion_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacion" ADD CONSTRAINT "operacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacion" ADD CONSTRAINT "operacion_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision" ADD CONSTRAINT "comision_opId_fkey" FOREIGN KEY ("opId") REFERENCES "operacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision" ADD CONSTRAINT "comision_cableId_fkey" FOREIGN KEY ("cableId") REFERENCES "cable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision" ADD CONSTRAINT "comision_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision" ADD CONSTRAINT "comision_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasto" ADD CONSTRAINT "gasto_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usdt_movimiento" ADD CONSTRAINT "usdt_movimiento_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cable" ADD CONSTRAINT "cable_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cable" ADD CONSTRAINT "cable_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cable" ADD CONSTRAINT "cable_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cable_movimiento" ADD CONSTRAINT "cable_movimiento_cableId_fkey" FOREIGN KEY ("cableId") REFERENCES "cable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_saldo_movimiento" ADD CONSTRAINT "cliente_saldo_movimiento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_saldo_movimiento" ADD CONSTRAINT "cliente_saldo_movimiento_opId_fkey" FOREIGN KEY ("opId") REFERENCES "operacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_saldo_movimiento" ADD CONSTRAINT "cliente_saldo_movimiento_cableId_fkey" FOREIGN KEY ("cableId") REFERENCES "cable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_saldo_movimiento" ADD CONSTRAINT "cliente_saldo_movimiento_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre" ADD CONSTRAINT "cierre_operadorCierreId_fkey" FOREIGN KEY ("operadorCierreId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_caja" ADD CONSTRAINT "cierre_caja_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_saldo_moneda" ADD CONSTRAINT "cierre_saldo_moneda_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_resultado_par" ADD CONSTRAINT "cierre_resultado_par_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_operador" ADD CONSTRAINT "cierre_operador_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_saldo_cliente" ADD CONSTRAINT "cierre_saldo_cliente_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_saldo_cliente" ADD CONSTRAINT "cierre_saldo_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_gasto_categoria" ADD CONSTRAINT "cierre_gasto_categoria_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizacion_snapshot" ADD CONSTRAINT "cotizacion_snapshot_parId_fkey" FOREIGN KEY ("parId") REFERENCES "par"("par") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eticket" ADD CONSTRAINT "eticket_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "operacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eticket" ADD CONSTRAINT "eticket_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eticket" ADD CONSTRAINT "eticket_confirmadoPor_fkey" FOREIGN KEY ("confirmadoPor") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eticket" ADD CONSTRAINT "eticket_creadoPor_fkey" FOREIGN KEY ("creadoPor") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramite" ADD CONSTRAINT "tramite_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramite" ADD CONSTRAINT "tramite_creadoPor_fkey" FOREIGN KEY ("creadoPor") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramite" ADD CONSTRAINT "tramite_asignadoA_fkey" FOREIGN KEY ("asignadoA") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reunion" ADD CONSTRAINT "reunion_creadaPor_fkey" FOREIGN KEY ("creadaPor") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reunion" ADD CONSTRAINT "reunion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_event" ADD CONSTRAINT "login_event_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
