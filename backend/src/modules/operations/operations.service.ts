import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateOpDto, UpdateOpDto, OpFilterDto } from './dto/operations.dto';
import { Operacion, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { aggregateByPar, aggregateByOperador } from './aggregators';

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

    const data: Prisma.OperacionUpdateInput = {};
    if (dto.status) data.status = dto.status;
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

    return this.prisma.operacion.update({
      where: { id },
      data,
      include: {
        par: true,
        cliente: true,
        operador: { select: { id: true, nombre: true } },
      },
    });
  }

  async finalize(id: string): Promise<Operacion> {
    const op = await this.findOne(id);
    if (op.status === 'finalizada') {
      throw new BadRequestException('La operación ya está finalizada');
    }
    if (op.status === 'cancelada') {
      throw new BadRequestException('No se puede finalizar una operación cancelada');
    }
    return this.prisma.operacion.update({
      where: { id },
      data: { status: 'finalizada', tsFinalizada: new Date() },
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

  /** KPIs agregados por par para un rango de fechas (día por default) */
  async kpisByPar(startDate?: Date, endDate?: Date) {
    const where: Prisma.OperacionWhereInput = { status: { not: 'cancelada' } };
    if (startDate || endDate) {
      where.ts = {};
      if (startDate) where.ts.gte = startDate;
      if (endDate) where.ts.lte = endDate;
    }

    const ops = await this.prisma.operacion.findMany({ where, include: { comision: true } });

    const mapped = ops.map((o) => ({
      par: o.parId,
      tipo: o.tipo,
      monto: o.monto.toString(),
      cotiz: o.cotiz.toString(),
      contra: o.contra.toString(),
      pricingMode: o.pricingMode,
      gananciaUsd: o.comision ? o.comision.monto.toString() : undefined,
    }));

    return aggregateByPar(mapped);
  }

  /** KPIs agregados por operador */
  async kpisByOperador(startDate?: Date, endDate?: Date) {
    const where: Prisma.OperacionWhereInput = { status: { not: 'cancelada' } };
    if (startDate || endDate) {
      where.ts = {};
      if (startDate) where.ts.gte = startDate;
      if (endDate) where.ts.lte = endDate;
    }

    const ops = await this.prisma.operacion.findMany({
      where,
      include: { operador: true, comision: true },
    });

    const mapped = ops.map((o) => ({
      operadorId: o.operadorId,
      operadorNombre: o.operador.nombre,
      tipo: o.tipo,
      contra: o.contra.toString(),
      comisionUsd: o.comision ? o.comision.monto.toString() : undefined,
    }));

    return aggregateByOperador(mapped);
  }
}
