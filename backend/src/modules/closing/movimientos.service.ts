import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateGastoDto, CreateMovimientoUsdDto } from './dto/movimientos.dto';

/**
 * #13 — Movimientos del día en USD que entran en el cierre: cables, USDT y
 * gastos (de la oficina o del jefe). Se cargan y se borran mientras el día no
 * está cerrado; una vez ligados a un cierre, los triggers de la base los
 * vuelven inmutables.
 */
@Injectable()
export class MovimientosService {
  constructor(private prisma: PrismaService) {}

  /** Próximo código correlativo (CB-0001, UT-0001, GS-0001). */
  private async conCodigo<T>(prefijo: string, contar: () => Promise<number>, crear: (codigo: string) => Promise<T>): Promise<T> {
    for (let intento = 0; intento < 3; intento++) {
      const codigo = `${prefijo}-${String((await contar()) + 1 + intento).padStart(4, '0')}`;
      try {
        return await crear(codigo);
      } catch (e) {
        // Código tomado por un alta simultánea: se prueba el siguiente.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new BadRequestException('No pude asignar un código; reintentá');
  }

  private ganancia(dto: CreateMovimientoUsdDto) {
    return new Decimal(dto.ingresoUsd).minus(dto.egresoUsd).minus(dto.comisionUsd);
  }

  /** Cable finalizado con sus dos patas (ingreso y salida), como exige el trigger. */
  createCable(dto: CreateMovimientoUsdDto, operadorId: string) {
    const ts = dto.fecha ?? new Date();
    return this.conCodigo('CB', () => this.prisma.cable.count(), (codigo) =>
      this.prisma.cable.create({
        data: {
          codigo,
          ts,
          tsFinalizada: ts,
          status: 'finalizada',
          operadorId,
          montoIngresoUsd: dto.ingresoUsd,
          montoSalidaUsd: dto.egresoUsd,
          diferenciaUsd: new Decimal(dto.ingresoUsd).minus(dto.egresoUsd).toFixed(2),
          comisionUsd: dto.comisionUsd,
          gananciaNetaUsd: this.ganancia(dto).toFixed(2),
          notas: dto.notas || null,
          movimientos: {
            create: [
              { lado: 'ingreso', moneda: 'USD', monto: dto.ingresoUsd },
              { lado: 'salida', moneda: 'USD', monto: dto.egresoUsd },
            ],
          },
        },
      }),
    );
  }

  createUsdt(dto: CreateMovimientoUsdDto, operadorId: string) {
    return this.conCodigo('UT', () => this.prisma.usdtOperacion.count(), (codigo) =>
      this.prisma.usdtOperacion.create({
        data: {
          codigo,
          fecha: dto.fecha ?? new Date(),
          operadorId,
          montoIngresoUsd: dto.ingresoUsd,
          montoEgresoUsd: dto.egresoUsd,
          comisionUsd: dto.comisionUsd,
          gananciaNetaUsd: this.ganancia(dto).toFixed(2),
          notas: dto.notas || null,
        },
      }),
    );
  }

  createGasto(dto: CreateGastoDto) {
    return this.conCodigo('GS', () => this.prisma.gasto.count(), (codigo) =>
      this.prisma.gasto.create({
        data: {
          codigo,
          fecha: dto.fecha ?? new Date(),
          concepto: dto.concepto,
          montoUsd: dto.montoUsd,
          tipo: dto.tipo,
          categoria: dto.categoria,
          notas: dto.notas || null,
        },
      }),
    );
  }

  /** Borra un movimiento cargado por error. No se puede si el día ya está cerrado. */
  async remove(tipo: 'cable' | 'usdt' | 'gasto', id: string): Promise<void> {
    const fila =
      tipo === 'cable' ? await this.prisma.cable.findUnique({ where: { id } })
      : tipo === 'usdt' ? await this.prisma.usdtOperacion.findUnique({ where: { id } })
      : await this.prisma.gasto.findUnique({ where: { id } });
    if (!fila) throw new NotFoundException('Movimiento no encontrado');
    if (fila.cierreId) throw new BadRequestException('El día ya está cerrado: el movimiento no se puede borrar');

    if (tipo === 'cable') await this.prisma.cable.delete({ where: { id } });
    else if (tipo === 'usdt') await this.prisma.usdtOperacion.delete({ where: { id } });
    else await this.prisma.gasto.delete({ where: { id } });
  }
}
