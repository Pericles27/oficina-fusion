import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { Par } from '@prisma/client';
import { UpdateQuotationDto } from './dto/quotation.dto';

@Injectable()
export class QuotationsService {
  constructor(private prisma: PrismaService) {}

  /** F6 — alcance mínimo: pares con compra/venta, nada de histórico. */
  async findAll(): Promise<Par[]> {
    return this.prisma.par.findMany({ orderBy: { par: 'asc' } });
  }

  async update(par: string, dto: UpdateQuotationDto): Promise<Par> {
    const existing = await this.prisma.par.findUnique({ where: { par } });
    if (!existing) throw new NotFoundException(`Par ${par} no existe`);

    return this.prisma.par.update({
      where: { par },
      data: { compra: dto.compra, venta: dto.venta },
    });
  }
}
