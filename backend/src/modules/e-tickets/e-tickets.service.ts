import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateEticketDto, UpdateEticketDto } from './dto/eticket.dto';
import { Eticket, EticketEstado, Prisma } from '@prisma/client';

@Injectable()
export class ETicketsService {
  constructor(private prisma: PrismaService) {}

  private async nextCodigo(): Promise<{ codigo: string; numero: number }> {
    const last = await this.prisma.eticket.findFirst({
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const numero = (last?.numero ?? 0) + 1;
    return { codigo: `ET-${String(numero).padStart(4, '0')}`, numero };
  }

  async create(dto: CreateEticketDto, creadoPor: string): Promise<Eticket> {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: dto.clienteId } });
    if (!cliente) throw new BadRequestException(`Cliente ${dto.clienteId} no existe`);

    if (dto.operationId) {
      const op = await this.prisma.operacion.findUnique({ where: { id: dto.operationId } });
      if (!op) throw new BadRequestException(`Operación ${dto.operationId} no existe`);
    }

    const { codigo, numero } = await this.nextCodigo();

    return this.prisma.eticket.create({
      data: {
        codigo,
        numero,
        clienteId: dto.clienteId,
        operationId: dto.operationId ?? undefined,
        metodoEntrega: dto.metodoEntrega,
        direccionEntrega: dto.direccionEntrega ?? undefined,
        telefonoContacto: dto.telefonoContacto ?? undefined,
        nombreRecibe: dto.nombreRecibe ?? undefined,
        horarioEntrega: dto.horarioEntrega ?? undefined,
        banco: dto.banco ?? undefined,
        cuentaDeposito: dto.cuentaDeposito ?? undefined,
        instrucciones: dto.instrucciones ?? undefined,
        monedaEntregar: dto.monedaEntregar ?? undefined,
        montoEntregar: dto.montoEntregar ?? undefined,
        monedaRecibir: dto.monedaRecibir ?? undefined,
        montoRecibir: dto.montoRecibir ?? undefined,
        creadoPor,
      },
    });
  }

  async findAll(params: { estado?: string; clienteId?: string; page?: number; pageSize?: number }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const where: Prisma.EticketWhereInput = {};
    if (params.estado) where.estado = params.estado as EticketEstado;
    if (params.clienteId) where.clienteId = params.clienteId;

    const [data, total] = await Promise.all([
      this.prisma.eticket.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { ts: 'desc' },
      }),
      this.prisma.eticket.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(id: string): Promise<Eticket> {
    const et = await this.prisma.eticket.findUnique({ where: { id } });
    if (!et) throw new NotFoundException(`E-Ticket ${id} no encontrado`);
    return et;
  }

  /** Vista para el cadete: NUNCA incluye datos económicos (montoEntregar/montoRecibir) */
  async findOneForCadete(id: string) {
    const et = await this.findOne(id);
    const { montoEntregar, montoRecibir, monedaEntregar, monedaRecibir, ...safe } = et;
    return safe;
  }

  async update(id: string, dto: UpdateEticketDto): Promise<Eticket> {
    await this.findOne(id);
    return this.prisma.eticket.update({
      where: { id },
      data: dto,
    });
  }

  async confirm(id: string, confirmadoPor: string): Promise<Eticket> {
    const et = await this.findOne(id);
    if (et.estado === 'confirmado') {
      throw new BadRequestException('El e-ticket ya está confirmado');
    }
    if (et.estado === 'cancelado') {
      throw new BadRequestException('No se puede confirmar un e-ticket cancelado');
    }
    return this.prisma.eticket.update({
      where: { id },
      data: { estado: 'confirmado', confirmadoPor, confirmadoEn: new Date() },
    });
  }

  async cancel(id: string): Promise<Eticket> {
    const et = await this.findOne(id);
    if (et.estado === 'confirmado') {
      throw new BadRequestException('No se puede cancelar un e-ticket ya confirmado');
    }
    return this.prisma.eticket.update({
      where: { id },
      data: { estado: 'cancelado' },
    });
  }
}
