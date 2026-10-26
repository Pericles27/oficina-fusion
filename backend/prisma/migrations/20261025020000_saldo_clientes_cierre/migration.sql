-- #19: la foto de saldos de clientes de cada cierre guarda si el saldo estaba
-- dentro de la caja o separado, para el reporte (balance = caja − saldos en caja).
ALTER TABLE "cierre_saldo_cliente" ADD COLUMN "custodia" TEXT NOT NULL DEFAULT 'caja';
