import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/create-customer.dto';
import { SaldoAdjustmentDto } from './dto/saldo-adjustment.dto';
import { Cliente, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCustomerDto): Promise<Cliente> {
    return this.prisma.cliente.create({
      data: {
        nombre: dto.nombre,
        apellido: dto.apellido,
        alias: dto.alias,
        tipo: dto.tipo,
        doc: dto.doc,
        custodia: dto.custodia,
        notas: dto.notas,
        puntosHabituales: dto.puntosHabituales,
      },
    });
  }

  async findAll(params: {
    q?: string;
    activo?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: Cliente[]; total: number; page: number; pageSize: number }> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const where: Prisma.ClienteWhereInput = {};
    if (params.activo !== undefined) where.activo = params.activo;
    if (params.q) {
      where.OR = [
        { nombre: { contains: params.q, mode: 'insensitive' } },
        { apellido: { contains: params.q, mode: 'insensitive' } },
        { alias: { contains: params.q, mode: 'insensitive' } },
        { doc: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(id: string): Promise<Cliente> {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Cliente> {
    await this.findOne(id);
    return this.prisma.cliente.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.cliente.update({ where: { id }, data: { activo: false } });
  }

  /**
   * Ajusta el saldo USD del cliente y registra el movimiento en el ledger.
   * tipo=credito suma saldo, tipo=debito resta saldo (no permite negativo).
   */
  async adjustSaldo(clienteId: string, dto: SaldoAdjustmentDto): Promise<Cliente> {
    const cliente = await this.findOne(clienteId);

    const delta = dto.tipo === 'credito' ? new Decimal(dto.montoUsd) : new Decimal(dto.montoUsd).neg();
    const saldoPost = new Decimal(cliente.saldoUsd.toString()).plus(delta);

    if (saldoPost.isNegative()) {
      throw new BadRequestException('El ajuste dejaría el saldo del cliente en negativo');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cliente.update({
        where: { id: clienteId },
        data: { saldoUsd: saldoPost.toFixed(2) },
      });

      await tx.clienteSaldoMovimiento.create({
        data: {
          clienteId,
          tipo: dto.tipo,
          montoUsd: dto.montoUsd.toFixed(2),
          saldoPostUsd: saldoPost.toFixed(2),
          manual: dto.manual,
          nota: dto.nota,
        },
      });

      return updated;
    });
  }
}
