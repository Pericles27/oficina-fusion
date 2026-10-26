import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateOpDto, UpdateOpDto, OpFilterDto } from './dto/operations.dto';
import { Operacion, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { moverSaldo, pataSaldo, revertirSaldoDeOperacion } from '../customers/saldo';
import { aggregateByPar, aggregateByOperador, cotizMonedaAUsd, monedasSinCotizacion, toUsd } from './aggregators';

@Injectable()
export class OperationsService {
  constructor(private prisma: PrismaService) {}

  private async nextCodigo(): Promise<{ codigo: string; numero: number }> {
    const last = await this.prisma.operacion.findFirst({
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const numero = (last?.numero ?? 0) + 1;
    return { codigo: `OP-${String(numero).padStart(4, '0')}`, numero };
  }

  async create(dto: CreateOpDto, operadorId: string): Promise<Operacion> {
    const par = await this.prisma.par.findUnique({ where: { par: dto.parId } });
    if (!par) throw new BadRequestException(`Par ${dto.parId} no existe`);

    const monto = new Decimal(dto.monto);
    const cotiz = new Decimal(dto.cotiz ?? (dto.tipo === 'C' ? par.compra.toString() : par.venta.toString()));
    const contra = monto.times(cotiz);

    if (dto.cobertura === 'saldo') {
      if (!dto.clienteId) throw new BadRequestException('Una operación contra saldo necesita un cliente');
      pataSaldo({ tipo: dto.tipo, monto, contra }, par);
    }

    const { codigo, numero } = await this.nextCodigo();

    return this.prisma.operacion.create({
      data: {
        codigo,
        numero,
        tipo: dto.tipo,
        parId: dto.parId,
        monto: monto.toFixed(4),
        cotiz: cotiz.toFixed(6),
        contra: contra.toFixed(4),
        cobertura: dto.cobertura,
        clienteId: dto.clienteId ?? undefined,
        marketRateId: dto.marketRateId ?? undefined,
        clientRate: new Decimal(dto.clientRate ?? cotiz).toFixed(6),
        puntos: dto.puntos ? new Decimal(dto.puntos).toFixed(6) : undefined,
        pricingMode: dto.pricingMode ?? undefined,
        notas: dto.notas ?? undefined,
        operadorId,
      },
      include: {
        par: true,
        cliente: true,
        operador: { select: { id: true, nombre: true } },
      },
    });
  }

  async findAll(filter: OpFilterDto): Promise<{ data: Operacion[]; total: number; page: number; pageSize: number }> {
    const where: Prisma.OperacionWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.tipo) where.tipo = filter.tipo;
    if (filter.parId) where.parId = filter.parId;
    if (filter.clienteId) where.clienteId = filter.clienteId;
    if (filter.operadorId) where.operadorId = filter.operadorId;
    if (filter.startDate || filter.endDate) {
      where.ts = {};
      if (filter.startDate) where.ts.gte = filter.startDate;
      if (filter.endDate) where.ts.lte = filter.endDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.operacion.findMany({
        where,
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        orderBy: { ts: 'desc' },
        include: {
          par: true,
          cliente: true,
          // R5 (ANALISIS-FASES-3-4-5.md): GET /users es ADMIN-only, un
          // OPERADOR no puede listar traders. En vez de abrir ese
          // endpoint, el nombre del operador viaja en la propia
          // operación — select limitado, no se expone el usuario entero
          // (username, passwordHash, etc. quedan afuera).
          operador: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.operacion.count({ where }),
    ]);

    return { data, total, page: filter.page, pageSize: filter.pageSize };
  }

  async findOne(id: string): Promise<Operacion> {
    const op = await this.prisma.operacion.findUnique({
      where: { id },
      include: {
        par: true,
        cliente: true,
        comision: true,
        operador: { select: { id: true, nombre: true } },
      },
    });
    if (!op) throw new NotFoundException(`Operación ${id} no encontrada`);
    return op;
  }

  async update(id: string, dto: UpdateOpDto): Promise<Operacion> {
    const existing = await this.findOne(id);
    if (existing.cierreId) {
      throw new BadRequestException('No se puede modificar una operación ya cerrada (inmutable)');
    }
    // U7: con un e-ticket activo, sus tramos tienen que seguir sumando lo mismo que la operación.
    const cambiaMontos = (dto.monto && !new Decimal(dto.monto).eq(existing.monto.toString()))
      || (dto.cotiz && !new Decimal(dto.cotiz).eq(existing.cotiz.toString()))
      || (dto.cobertura && dto.cobertura !== existing.cobertura);
    if (cambiaMontos) {
      const eticket = await this.prisma.eticket.findFirst({
        where: { operationId: id, estado: { not: 'cancelado' } },
        select: { codigo: true },
      });
      if (eticket) {
        throw new BadRequestException(
          `La operación tiene el e-ticket ${eticket.codigo}: cancelalo antes de cambiar monto, cotización o cobertura`,
        );
      }
    }

    const cobertura = dto.cobertura ?? existing.cobertura;
    const clienteId = dto.clienteId === undefined ? existing.clienteId : dto.clienteId;
    if (cobertura === 'saldo') {
      if (!clienteId) throw new BadRequestException('Una operación contra saldo necesita un cliente');
      const { par } = existing as Operacion & { par: { base: string; quote: string } };
      pataSaldo({ tipo: existing.tipo, monto: existing.monto.toString(), contra: existing.contra.toString() }, par);
    }
    const eraFinalizada = existing.status === 'finalizada';
    // #19: el movimiento de saldo se calculó al finalizar; cambiarlo después lo dejaría desfasado.
    const tocaSaldo = existing.cobertura === 'saldo' || cobertura === 'saldo';
    if (eraFinalizada && tocaSaldo && dto.status === undefined
        && (dto.cobertura || dto.clienteId !== undefined || dto.monto || dto.cotiz)) {
      throw new BadRequestException('Una operación contra saldo finalizada no se edita: volvela a pendiente primero');
    }

    const data: Prisma.OperacionUpdateInput = {};
    if (dto.status) data.status = dto.status;
    if (dto.clienteId !== undefined) data.cliente = dto.clienteId ? { connect: { id: dto.clienteId } } : { disconnect: true };
    if (dto.notas !== undefined) data.notas = dto.notas;
    if (dto.cobertura) data.cobertura = dto.cobertura;
    if (dto.tsEjecucion !== undefined) data.tsEjecucion = dto.tsEjecucion;
    if (dto.tsFinalizada !== undefined) data.tsFinalizada = dto.tsFinalizada;
    if (dto.monto) data.monto = new Decimal(dto.monto).toFixed(4);
    if (dto.cotiz) data.cotiz = new Decimal(dto.cotiz).toFixed(6);
    if (dto.monto || dto.cotiz) {
      const monto = new Decimal(dto.monto ?? existing.monto.toString());
      const cotiz = new Decimal(dto.cotiz ?? existing.cotiz.toString());
      data.contra = monto.times(cotiz).toFixed(4);
    }

    if (dto.status === 'finalizada' && !eraFinalizada) data.tsFinalizada = dto.tsFinalizada ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.operacion.update({
        where: { id },
        data,
        include: {
          par: true,
          cliente: true,
          operador: { select: { id: true, nombre: true } },
        },
      });
      // #19: el saldo del cliente se mueve al finalizar y se libera si deja de estarlo.
      if (dto.status && dto.status !== 'finalizada' && eraFinalizada) await revertirSaldoDeOperacion(tx, updated);
      if (dto.status === 'finalizada' && !eraFinalizada) await this.aplicarSaldo(tx, updated);
      return updated;
    });
  }

  /** #19 — Liquida contra el saldo del cliente la pata en USD de una operación con cobertura saldo. */
  private async aplicarSaldo(tx: Prisma.TransactionClient, op: Operacion & { par: { base: string; quote: string } }) {
    if (op.cobertura !== 'saldo' || !op.clienteId) return;
    const pata = pataSaldo({ tipo: op.tipo, monto: op.monto.toString(), contra: op.contra.toString() }, op.par);
    await moverSaldo(tx, { clienteId: op.clienteId, tipo: pata.tipo, montoUsd: pata.montoUsd, opId: op.id, manual: false, nota: op.codigo });
  }

  async finalize(id: string): Promise<Operacion> {
    const op = await this.findOne(id);
    if (op.status === 'finalizada') {
      throw new BadRequestException('La operación ya está finalizada');
    }
    if (op.status === 'cancelada') {
      throw new BadRequestException('No se puede finalizar una operación cancelada');
    }
    if (op.cobertura === 'saldo' && !op.clienteId) {
      throw new BadRequestException('Una operación contra saldo necesita un cliente');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.operacion.update({
        where: { id },
        data: { status: 'finalizada', tsFinalizada: new Date() },
        include: { par: true },
      });
      await this.aplicarSaldo(tx, updated);
      return updated;
    });
  }

  async cancel(id: string): Promise<Operacion> {
    const op = await this.findOne(id);
    if (op.cierreId) {
      throw new BadRequestException('No se puede cancelar una operación ya cerrada');
    }
    if (op.status === 'finalizada') {
      throw new BadRequestException('No se puede cancelar una operación finalizada');
    }
    return this.prisma.operacion.update({
      where: { id },
      data: { status: 'cancelada' },
    });
  }

  /**
   * KPIs agregados por par (B2): ganancia = spread − comisiones, en USD.
   * Las canceladas no generan spread ni comisión. Sin TC de cierre, ARS se
   * convierte con la venta de USD/ARS (misma regla que Admin_caja).
   */
  async kpisByPar(startDate?: Date, endDate?: Date) {
    const where: Prisma.OperacionWhereInput = { status: { not: 'cancelada' } };
    if (startDate || endDate) {
      where.ts = {};
      if (startDate) where.ts.gte = startDate;
      if (endDate) where.ts.lte = endDate;
    }

    const [ops, pares] = await Promise.all([
      this.prisma.operacion.findMany({ where, include: { comision: true } }),
      this.prisma.par.findMany(),
    ]);

    const opsInput = ops.map((o) => ({
      id: o.id,
      par: o.parId,
      tipo: o.tipo,
      monto: o.monto.toString(),
      cotiz: o.cotiz.toString(),
      contra: o.contra.toString(),
    }));
    const comisiones = ops.flatMap((o) => (o.comision
      ? [{ opId: o.id, monto: o.comision.monto.toString(), moneda: o.comision.moneda }]
      : []));
    const paresInput = pares.map((p) => ({
      par: p.par, base: p.base, quote: p.quote, compra: p.compra.toString(), venta: p.venta.toString(),
    }));

    return {
      ...aggregateByPar(opsInput, comisiones, paresInput),
      monedasSinCotizacion: monedasSinCotizacion(opsInput, paresInput),
    };
  }

  /** KPIs agregados por operador */
  async kpisByOperador(startDate?: Date, endDate?: Date) {
    const where: Prisma.OperacionWhereInput = { status: { not: 'cancelada' } };
    if (startDate || endDate) {
      where.ts = {};
      if (startDate) where.ts.gte = startDate;
      if (endDate) where.ts.lte = endDate;
    }

    const [ops, pares] = await Promise.all([
      this.prisma.operacion.findMany({
        where,
        include: { operador: true, comision: true, par: true },
      }),
      this.prisma.par.findMany(),
    ]);
    const paresInput = pares.map((p) => ({
      par: p.par, base: p.base, quote: p.quote, compra: p.compra.toString(), venta: p.venta.toString(),
    }));

    // B2: una comisión en moneda quote se convierte a USD; nunca se suma como USD.
    const mapped = ops.map((o) => ({
      operadorId: o.operadorId,
      operadorNombre: o.operador.nombre,
      tipo: o.tipo,
      // #9: el volumen se suma en USD, igual que en kpis/par (contra está en quote).
      volumenUsd: toUsd(new Decimal(o.contra.toString()), o.par.quote, paresInput).toString(),
      comisionUsd: !o.comision
        ? undefined
        : o.comision.moneda === 'USD'
          ? o.comision.monto.toString()
          : o.comision.monto.times(cotizMonedaAUsd(o.par.quote, paresInput).toString()).toString(),
    }));

    return aggregateByOperador(mapped);
  }
}
