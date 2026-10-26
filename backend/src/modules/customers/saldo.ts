// =============================================================
// #19 — Saldo de clientes con la oficina (siempre en USD)
// -------------------------------------------------------------
// Decisiones de Nicolás (2026-10-25):
// - Se lleva el saldo de cada cliente; normalmente no queda negativo,
//   pero puede pasar, así que se admite.
// - Por cliente se define si su saldo está dentro de la caja
//   (custodia "caja") o separado ("separada"). Sólo los movimientos de
//   saldo de clientes "caja" afectan el saldo esperado del cierre.
// - El cliente suma saldo siempre entregando efectivo (no hay depósitos
//   bancarios entrantes) o lo retira; esos movimientos los carga el ADMIN.
// - Una operación con cobertura "saldo" liquida su pata en USD contra el
//   saldo al finalizarse.
// =============================================================

import { BadRequestException } from '@nestjs/common';
import { Prisma, ClienteSaldoTipo, OpTipo } from '@prisma/client';
import { Decimal } from 'decimal.js';

export const CUSTODIAS = ['caja', 'separada'] as const;
export type Custodia = (typeof CUSTODIAS)[number];

/** Clientes cargados antes de #19 no tienen custodia: se toman como "caja". */
export const custodiaDe = (custodia: string | null | undefined): Custodia =>
  custodia === 'separada' ? 'separada' : 'caja';

/**
 * Registra un movimiento de saldo y actualiza el saldo del cliente.
 * `montoUsd` se guarda con signo (CHECK cliente_saldo_mov_signo): débito < 0, crédito > 0.
 * El llamador pasa el monto en positivo.
 * Debe correr dentro de una transacción: bloquea la fila del cliente para
 * que dos movimientos simultáneos no calculen el mismo saldo posterior.
 */
export async function moverSaldo(
  tx: Prisma.TransactionClient,
  params: { clienteId: string; tipo: ClienteSaldoTipo; montoUsd: Decimal.Value; opId?: string; manual: boolean; nota?: string | null; ts?: Date },
) {
  await tx.$queryRaw`SELECT id FROM cliente WHERE id = ${params.clienteId} FOR UPDATE`;
  const cliente = await tx.cliente.findUnique({ where: { id: params.clienteId }, select: { saldoUsd: true } });
  if (!cliente) throw new BadRequestException(`Cliente ${params.clienteId} no existe`);

  const monto = new Decimal(params.montoUsd).toDecimalPlaces(2);
  if (monto.lte(0)) throw new BadRequestException('El monto del movimiento de saldo debe ser mayor que 0');
  const delta = params.tipo === 'credito' ? monto : monto.neg();
  const saldoPost = new Decimal(cliente.saldoUsd.toString()).plus(delta);

  await tx.cliente.update({ where: { id: params.clienteId }, data: { saldoUsd: saldoPost.toFixed(2) } });
  return tx.clienteSaldoMovimiento.create({
    data: {
      clienteId: params.clienteId,
      tipo: params.tipo,
      montoUsd: delta.toFixed(2),
      saldoPostUsd: saldoPost.toFixed(2),
      opId: params.opId,
      manual: params.manual,
      nota: params.nota ?? null,
      ...(params.ts ? { ts: params.ts } : {}),
    },
  });
}

/**
 * Pata en USD de una operación con cobertura "saldo".
 * Compra (C): la oficina recibe `monto` en base y entrega `contra` en quote.
 * Si la oficina recibe USD, el cliente lo paga con su saldo (débito);
 * si la oficina entrega USD, queda en el saldo del cliente (crédito).
 */
export function pataSaldo(op: { tipo: OpTipo; monto: Decimal.Value; contra: Decimal.Value }, par: { base: string; quote: string }) {
  const recibe = op.tipo === 'C' ? { moneda: par.base, monto: op.monto } : { moneda: par.quote, monto: op.contra };
  const entrega = op.tipo === 'C' ? { moneda: par.quote, monto: op.contra } : { moneda: par.base, monto: op.monto };
  if (recibe.moneda === 'USD') return { tipo: 'debito' as const, montoUsd: new Decimal(recibe.monto) };
  if (entrega.moneda === 'USD') return { tipo: 'credito' as const, montoUsd: new Decimal(entrega.monto) };
  throw new BadRequestException(`El par ${par.base}/${par.quote} no tiene pata en USD: no se puede cubrir con saldo`);
}

/** Libera el movimiento de saldo de una operación que deja de estar finalizada, con un contraasiento. */
export async function revertirSaldoDeOperacion(tx: Prisma.TransactionClient, op: { id: string; codigo: string }) {
  const mov = await tx.clienteSaldoMovimiento.findUnique({ where: { opId: op.id } });
  if (!mov) return;
  if (mov.cierreId) throw new BadRequestException(`El movimiento de saldo de ${op.codigo} ya está en un cierre`);
  // El original queda en el historial; se desliga para que la operación pueda volver a finalizarse.
  // Cada movimiento tiene exactamente un origen (CHECK cliente_saldo_mov_origen_unico): sin
  // operación, el original y su contraasiento quedan como manuales, con la nota que los explica.
  await tx.clienteSaldoMovimiento.update({
    where: { id: mov.id },
    data: { opId: null, manual: true, nota: `${op.codigo} (anulado)` },
  });
  await moverSaldo(tx, {
    clienteId: mov.clienteId,
    tipo: mov.tipo === 'credito' ? 'debito' : 'credito',
    montoUsd: mov.montoUsd.abs().toString(),
    manual: true,
    nota: `Anula movimiento de ${op.codigo}`,
  });
}
