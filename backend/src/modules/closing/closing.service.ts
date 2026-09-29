import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateCierreDto } from './dto/closing.dto';
import { Cierre } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { aggregateByPar } from '../operations/aggregators';

@Injectable()
export class ClosingService {
  constructor(private prisma: PrismaService) {}

  /** Crea un cierre en estado "borrador" agregando las operaciones finalizadas del día. */
  async create(dto: CreateCierreDto, operadorCierreId: string): Promise<Cierre> {
    const existing = await this.prisma.cierre.findUnique({ where: { fecha: dto.fecha } });
    if (existing) {
      throw new BadRequestException(`Ya existe un cierre para la fecha ${dto.fecha.toISOString()}`);
    }

    const operador = await this.prisma.usuario.findUnique({ where: { id: operadorCierreId } });
    if (!operador) throw new BadRequestException('Operador no encontrado');

    const startOfDay = new Date(dto.fecha);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dto.fecha);
    endOfDay.setHours(23, 59, 59, 999);

    const ops = await this.prisma.operacion.findMany({
      where: {
        ts: { gte: startOfDay, lte: endOfDay },
        status: 'finalizada',
        cierreId: null,
      },
    });

    const agg = aggregateByPar(
      ops.map((o) => ({
        par: o.parId,
        tipo: o.tipo,
        monto: o.monto.toString(),
        cotiz: o.cotiz.toString(),
        contra: o.contra.toString(),
        pricingMode: o.pricingMode,
      })),
    );

    const comisiones = await this.prisma.comision.findMany({
      where: { opId: { in: ops.map((o) => o.id) } },
    });
    const totalComisionesUsd = comisiones.reduce(
      (acc, c) => acc.plus(new Decimal(c.monto.toString())),
      new Decimal(0),
    );

    const gastos = await this.prisma.gasto.findMany({
      where: {
        fecha: { gte: startOfDay, lte: endOfDay },
        cierreId: null,
      },
    });
    // Gasto.monto siempre está en ARS por convención del schema
    const totalGastosArs = gastos.reduce(
      (acc, g) => acc.plus(new Decimal(g.monto.toString())),
      new Decimal(0),
    );
    const totalGastosUsd = new Decimal(0);

    const saldoInicial = new Decimal(dto.saldoInicialUsd);
    const cajaContada = new Decimal(dto.cajaContadaUsd);
    const gananciaRealizadaUsd = new Decimal(agg.gananciaTotalUsd);
    const posicionEsperadaUsd = saldoInicial.plus(gananciaRealizadaUsd).minus(totalComisionesUsd).minus(totalGastosUsd);
    const diferenciaUsd = cajaContada.minus(posicionEsperadaUsd);
    const resultadoOperativoUsd = gananciaRealizadaUsd.minus(totalComisionesUsd).minus(totalGastosUsd);

    const cierre = await this.prisma.cierre.create({
      data: {
        fecha: dto.fecha,
        estado: 'borrador',
        operadorCierreId,
        operadorCierreNombre: operador.nombre,
        tcCierre: dto.tcCierre,
        saldoInicialUsd: dto.saldoInicialUsd,
        cajaContadaUsd: dto.cajaContadaUsd,
        posicionEsperadaUsd: posicionEsperadaUsd.toFixed(2),
        diferenciaUsd: diferenciaUsd.toFixed(2),
        gananciaRealizadaUsd: gananciaRealizadaUsd.toFixed(2),
        exposicionAbiertaUsd: '0',
        netoAbiertoUsd: '0',
        totalComisionesUsd: totalComisionesUsd.toFixed(2),
        totalGastosArs: totalGastosArs.toFixed(2),
        totalGastosUsd: totalGastosUsd.toFixed(2),
        resultadoOperativoUsd: resultadoOperativoUsd.toFixed(2),
        volumenTotalUsd: String(agg.volumenTotalUsd),
        nOps: ops.length,
        notas: dto.notas ?? undefined,
      },
    });

    if (ops.length > 0) {
      await this.prisma.operacion.updateMany({
        where: { id: { in: ops.map((o) => o.id) } },
        data: { cierreId: cierre.id },
      });
    }

    return cierre;
  }

  async findAll(params: { page?: number; pageSize?: number } = {}) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const [data, total] = await Promise.all([
      this.prisma.cierre.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { fecha: 'desc' },
      }),
      this.prisma.cierre.count(),
    ]);
    return { data, total, page, pageSize };
  }

  async findOne(id: string): Promise<Cierre> {
    const c = await this.prisma.cierre.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Cierre ${id} no encontrado`);
    return c;
  }

  /** confirmado: el cierre y sus operaciones quedan inmutables. */
  async confirm(id: string): Promise<Cierre> {
    const c = await this.findOne(id);
    if (c.estado === 'confirmado') {
      throw new BadRequestException('El cierre ya está confirmado');
    }
    return this.prisma.cierre.update({
      where: { id },
      data: { estado: 'confirmado', confirmedAt: new Date() },
    });
  }

  /** reabierto: permite corregir operaciones del cierre antes de re-confirmar. */
  async reopen(id: string): Promise<Cierre> {
    const c = await this.findOne(id);
    if (c.estado !== 'confirmado') {
      throw new BadRequestException('Solo se puede reabrir un cierre confirmado');
    }
    return this.prisma.cierre.update({
      where: { id },
      data: { estado: 'reabierto', reopenedAt: new Date() },
    });
  }
}
