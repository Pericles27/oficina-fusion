import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateCierreDto } from './dto/closing.dto';
import { Cierre, CierreSaldoReal, Moneda, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { aggregateByPar, toUsd } from '../operations/aggregators';
import { custodiaDe } from '../customers/saldo';

/** Entradas/salidas de caja de una moneda en el día (strings decimales). */
export interface MovimientoMoneda {
  moneda: string;
  entradas: string;
  salidas: string;
  neto: string;
}

export interface GastoDia {
  id: string;
  codigo: string;
  concepto: string;
  categoria: string;
  /** OFICINA | JEFE (gasto del día) | JEFE_A_DEVOLVER (deuda del jefe). */
  tipo: string;
  /** Monto en USD; para gastos viejos cargados en ARS, convertido con el TC de cierre. */
  montoUsd: string;
  /** Sólo gastos viejos (legado en ARS). */
  montoArs: string | null;
}

/** #13 — Cable o USDT del día: ingreso, egreso y comisión (la paga la oficina), en USD. */
export interface MovimientoUsd {
  id: string;
  codigo: string;
  ingresoUsd: string;
  egresoUsd: string;
  comisionUsd: string;
  /** Implícita: ingreso − egreso − comisión. */
  gananciaUsd: string;
  notas: string | null;
}

export interface TotalesMovimientoUsd {
  ingresoUsd: string;
  egresoUsd: string;
  comisionUsd: string;
  gananciaUsd: string;
}

/** #19 — Movimiento de saldo de un cliente en el día. */
export interface MovimientoSaldoCliente {
  id: string;
  clienteId: string;
  clienteNombre: string;
  /** Si el saldo del cliente está dentro de la caja: sólo esos mueven el saldo esperado. */
  enCaja: boolean;
  tipo: 'credito' | 'debito';
  montoUsd: string;
  /** Operación contra saldo que lo generó, o null si es manual. */
  opCodigo: string | null;
  nota: string | null;
}

export interface SaldoClienteReporte {
  clienteId: string;
  clienteNombre: string;
  custodia: string;
  saldoUsdApertura: string;
  saldoUsdCierre: string;
  deltaUsd: string;
}

/** #19 — Reporte de cierre que se le manda al jefe por WhatsApp. */
export interface ReporteCierre {
  fecha: string;
  estado: string;
  gananciaCambioUsd: string;
  gananciaCablesUsd: string;
  gananciaUsdtUsd: string;
  gananciaTotalUsd: string;
  totalGastosUsd: string;
  resultadoOperativoUsd: string;
  /** Saldo de caja: lo contado al cierre. */
  cajaContadaUsd: string;
  posicionEsperadaUsd: string;
  diferenciaUsd: string;
  saldosClientes: SaldoClienteReporte[];
  totalSaldosCajaUsd: string;
  totalSaldosSeparadosUsd: string;
  /** Saldo de caja − saldos de clientes que están dentro de la caja. */
  balanceUsd: string;
}

/** #12 — Lo que el cierre del día va a tomar, antes de guardarlo. */
export interface ResumenDia {
  fecha: string;
  tcCierre: string;
  nOpsFinalizadas: number;
  /** Operaciones del día sin finalizar: no entran en el cierre. */
  nOpsSinFinalizar: number;
  movimientos: MovimientoMoneda[];
  /** Ganancia por spread de las operaciones de cambio. */
  gananciaRealizadaUsd: string;
  totalComisionesUsd: string;
  cables: MovimientoUsd[];
  totalCables: TotalesMovimientoUsd;
  usdt: MovimientoUsd[];
  totalUsdt: TotalesMovimientoUsd;
  gastos: GastoDia[];
  totalGastosArs: string;
  /** Gastos del día (oficina + jefe que no se devuelve). */
  totalGastosUsd: string;
  /** Gastos del jefe a devolver: salen de la caja pero no son gasto del día. */
  deudaJefeUsd: string;
  /** Cambio (spread − comisiones) + cables + USDT. */
  gananciaTotalUsd: string;
  /** gananciaTotal − gastos del día. */
  resultadoOperativoUsd: string;
  volumenTotalUsd: string;
  /** #19: movimientos de saldo de clientes del día (dentro y fuera de la caja). */
  saldoClientes: MovimientoSaldoCliente[];
  /** Neto de los saldos de clientes dentro de la caja: créditos − débitos. */
  saldoClientesNetoCajaUsd: string;
}

export interface PreviewCierre extends ResumenDia {
  /** Caja contada del último cierre anterior: sugerencia de saldo inicial. */
  saldoInicialSugeridoUsd: string | null;
  saldoInicialUsd: string;
  posicionEsperadaUsd: string;
  /** Cierre ya guardado para esta fecha, si existe. */
  cierreExistenteId: string | null;
}

type CierreConSaldos = Cierre & { saldosReales: CierreSaldoReal[] };

const rangoDelDia = (fecha: Date) => {
  const startOfDay = new Date(fecha);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(fecha);
  endOfDay.setHours(23, 59, 59, 999);
  return { startOfDay, endOfDay };
};

@Injectable()
export class ClosingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Agrega las operaciones finalizadas (sin cierre) y los gastos del día.
   * Es la misma cuenta que usa `create`; `preview` la muestra antes de guardar.
   * Con `cierreId` toma las operaciones ya ligadas a ese cierre (para mostrarlo).
   */
  private async resumenDia(fecha: Date, tcCierreRaw: string, cierreId: string | null = null) {
    const { startOfDay, endOfDay } = rangoDelDia(fecha);

    const [ops, nOpsSinFinalizar, pares, gastos, cables, usdt, saldoMovs] = await Promise.all([
      this.prisma.operacion.findMany({
        where: { ts: { gte: startOfDay, lte: endOfDay }, status: 'finalizada', cierreId },
      }),
      this.prisma.operacion.count({
        where: { ts: { gte: startOfDay, lte: endOfDay }, status: { in: ['pendiente', 'en_ejecucion'] } },
      }),
      this.prisma.par.findMany(),
      this.prisma.gasto.findMany({
        where: { fecha: { gte: startOfDay, lte: endOfDay }, cierreId },
        orderBy: { fecha: 'asc' },
      }),
      this.prisma.cable.findMany({
        where: { ts: { gte: startOfDay, lte: endOfDay }, status: 'finalizada', cierreId },
        orderBy: { ts: 'asc' },
      }),
      this.prisma.usdtOperacion.findMany({
        where: { fecha: { gte: startOfDay, lte: endOfDay }, cierreId },
        orderBy: { fecha: 'asc' },
      }),
      this.prisma.clienteSaldoMovimiento.findMany({
        where: { ts: { gte: startOfDay, lte: endOfDay }, cierreId },
        orderBy: [{ ts: 'asc' }, { createdAt: 'asc' }],
        include: {
          cliente: { select: { nombre: true, apellido: true, custodia: true } },
          operacion: { select: { codigo: true } },
        },
      }),
    ]);

    const comisiones = await this.prisma.comision.findMany({ where: { opId: { in: ops.map((o) => o.id) } } });
    const paresInput = pares.map((p) => ({
      par: p.par, base: p.base, quote: p.quote, compra: p.compra.toString(), venta: p.venta.toString(),
    }));
    const tcCierre = new Decimal(tcCierreRaw || '0');

    // B2: spread y comisiones en USD con el TC de cierre (lógica de Admin_caja).
    const agg = aggregateByPar(
      ops.map((o) => ({
        id: o.id,
        par: o.parId,
        tipo: o.tipo,
        monto: o.monto.toString(),
        cotiz: o.cotiz.toString(),
        contra: o.contra.toString(),
      })),
      comisiones.flatMap((c) => (c.opId ? [{ opId: c.opId, monto: c.monto.toString(), moneda: c.moneda }] : [])),
      paresInput,
      tcCierre,
    );
    const totalComisionesUsd = new Decimal(agg.comisionesUsd);

    // Movimientos de caja por moneda. Compra: entra base, sale quote. Venta: al revés.
    const mov = new Map<string, { entradas: Decimal; salidas: Decimal }>();
    const sumar = (moneda: string, k: 'entradas' | 'salidas', v: Decimal) => {
      const m = mov.get(moneda) ?? { entradas: new Decimal(0), salidas: new Decimal(0) };
      m[k] = m[k].plus(v);
      mov.set(moneda, m);
    };
    for (const o of ops) {
      const pdef = pares.find((p) => p.par === o.parId);
      if (!pdef) continue;
      const base = new Decimal(o.monto.toString());
      const quote = new Decimal(o.contra.toString());
      if (o.tipo === 'C') { sumar(pdef.base, 'entradas', base); sumar(pdef.quote, 'salidas', quote); }
      else { sumar(pdef.base, 'salidas', base); sumar(pdef.quote, 'entradas', quote); }
    }
    const ordenMonedas = Object.values(Moneda) as string[];
    const movimientos: MovimientoMoneda[] = [...mov.entries()]
      .sort(([a], [b]) => ordenMonedas.indexOf(a) - ordenMonedas.indexOf(b))
      .map(([moneda, m]) => ({
        moneda,
        entradas: m.entradas.toFixed(2),
        salidas: m.salidas.toFixed(2),
        neto: m.entradas.minus(m.salidas).toFixed(2),
      }));

    // #13: gastos en USD. Los viejos (legado) tienen sólo `monto` en ARS.
    const D0 = new Decimal(0);
    const gastoUsd = (g: (typeof gastos)[number]) =>
      g.montoUsd !== null
        ? new Decimal(g.montoUsd.toString())
        : toUsd(new Decimal(g.monto?.toString() ?? '0'), 'ARS', paresInput, tcCierre).toDecimalPlaces(2);
    const totalGastosArs = gastos.reduce(
      (acc, g) => (g.montoUsd === null && g.monto !== null ? acc.plus(g.monto.toString()) : acc),
      D0,
    );
    const totalGastosUsd = gastos
      .filter((g) => g.tipo !== 'JEFE_A_DEVOLVER')
      .reduce((acc, g) => acc.plus(gastoUsd(g)), D0);
    const deudaJefeUsd = gastos
      .filter((g) => g.tipo === 'JEFE_A_DEVOLVER')
      .reduce((acc, g) => acc.plus(gastoUsd(g)), D0);

    // #13: cables y USDT. La ganancia queda implícita: ingreso − egreso − comisión.
    const movUsd = (rows: Array<{ id: string; codigo: string; ingreso: Decimal.Value; egreso: Decimal.Value; comision: Decimal.Value; notas: string | null }>) => {
      const lista: MovimientoUsd[] = rows.map((r) => {
        const ganancia = new Decimal(r.ingreso).minus(r.egreso).minus(r.comision);
        return {
          id: r.id, codigo: r.codigo, notas: r.notas,
          ingresoUsd: new Decimal(r.ingreso).toFixed(2),
          egresoUsd: new Decimal(r.egreso).toFixed(2),
          comisionUsd: new Decimal(r.comision).toFixed(2),
          gananciaUsd: ganancia.toFixed(2),
        };
      });
      const suma = (k: keyof TotalesMovimientoUsd) => lista.reduce((acc, m) => acc.plus(m[k]), D0).toFixed(2);
      return { lista, totales: { ingresoUsd: suma('ingresoUsd'), egresoUsd: suma('egresoUsd'), comisionUsd: suma('comisionUsd'), gananciaUsd: suma('gananciaUsd') } };
    };
    const cablesDia = movUsd(cables.map((c) => ({
      id: c.id, codigo: c.codigo, notas: c.notas,
      ingreso: c.montoIngresoUsd.toString(), egreso: c.montoSalidaUsd.toString(), comision: c.comisionUsd.toString(),
    })));
    const usdtDia = movUsd(usdt.map((u) => ({
      id: u.id, codigo: u.codigo, notas: u.notas,
      ingreso: u.montoIngresoUsd.toString(), egreso: u.montoEgresoUsd.toString(), comision: u.comisionUsd.toString(),
    })));

    const gananciaRealizadaUsd = new Decimal(agg.spreadUsd);
    const gananciaTotalUsd = gananciaRealizadaUsd
      .minus(totalComisionesUsd)
      .plus(cablesDia.totales.gananciaUsd)
      .plus(usdtDia.totales.gananciaUsd);
    const resultadoOperativoUsd = gananciaTotalUsd.minus(totalGastosUsd);

    // #19: saldos de clientes. Un crédito de un cliente "caja" es efectivo que quedó en la caja;
    // un débito, lo que salió de la caja contra su saldo. Los "separada" no tocan la caja.
    const saldoClientes: MovimientoSaldoCliente[] = saldoMovs.map((m) => ({
      id: m.id,
      clienteId: m.clienteId,
      clienteNombre: m.cliente.apellido ? `${m.cliente.nombre} ${m.cliente.apellido}` : m.cliente.nombre,
      enCaja: custodiaDe(m.cliente.custodia) === 'caja',
      tipo: m.tipo,
      montoUsd: m.montoUsd.abs().toFixed(2),
      opCodigo: m.operacion?.codigo ?? null,
      nota: m.nota,
    }));
    const saldoClientesNetoCajaUsd = saldoClientes
      .filter((m) => m.enCaja)
      .reduce((acc, m) => (m.tipo === 'credito' ? acc.plus(m.montoUsd) : acc.minus(m.montoUsd)), D0);

    const resumen: ResumenDia = {
      fecha: startOfDay.toISOString(),
      tcCierre: tcCierre.toString(),
      nOpsFinalizadas: ops.length,
      nOpsSinFinalizar,
      movimientos,
      gananciaRealizadaUsd: gananciaRealizadaUsd.toFixed(2),
      totalComisionesUsd: totalComisionesUsd.toFixed(2),
      cables: cablesDia.lista,
      totalCables: cablesDia.totales,
      usdt: usdtDia.lista,
      totalUsdt: usdtDia.totales,
      gastos: gastos.map((g) => ({
        id: g.id, codigo: g.codigo, concepto: g.concepto, categoria: g.categoria, tipo: g.tipo,
        montoUsd: gastoUsd(g).toFixed(2),
        montoArs: g.montoUsd === null && g.monto !== null ? g.monto.toFixed(2) : null,
      })),
      totalGastosArs: totalGastosArs.toFixed(2),
      totalGastosUsd: totalGastosUsd.toFixed(2),
      deudaJefeUsd: deudaJefeUsd.toFixed(2),
      gananciaTotalUsd: gananciaTotalUsd.toFixed(2),
      resultadoOperativoUsd: resultadoOperativoUsd.toFixed(2),
      volumenTotalUsd: agg.volumenUsd,
      saldoClientes,
      saldoClientesNetoCajaUsd: saldoClientesNetoCajaUsd.toFixed(2),
    };
    return {
      resumen,
      opIds: ops.map((o) => o.id),
      gastoIds: gastos.map((g) => g.id),
      cableIds: cables.map((c) => c.id),
      usdtIds: usdt.map((u) => u.id),
      saldoMovIds: saldoMovs.map((m) => m.id),
      ops,
      paresInput,
      tcCierre,
    };
  }

  /**
   * Saldo esperado = saldo inicial + resultado del día − deuda del jefe + neto de saldos de clientes en caja.
   * resultado = spread − comisiones + cables + USDT − gastos del día (Admin_caja + #13).
   * Lo que se lleva el jefe a devolver sale de la caja aunque no sea gasto.
   */
  private posicionEsperada(saldoInicialUsd: Decimal.Value, r: ResumenDia): Decimal {
    return new Decimal(saldoInicialUsd)
      .plus(r.resultadoOperativoUsd)
      .minus(r.deudaJefeUsd)
      .plus(r.saldoClientesNetoCajaUsd);
  }

  /** #12 — Resumen del día y saldo esperado, sin escribir nada. */
  async preview(fecha: Date, tcCierre?: string, saldoInicialUsd?: string): Promise<PreviewCierre> {
    if (Number.isNaN(fecha.getTime())) throw new BadRequestException('Fecha inválida');
    // Cierre.fecha es @db.Date: se compara con la misma fecha que recibe `create`.
    const [anterior, existente] = await Promise.all([
      this.prisma.cierre.findFirst({ where: { fecha: { lt: fecha } }, orderBy: { fecha: 'desc' } }),
      this.prisma.cierre.findUnique({ where: { fecha } }),
    ]);
    // Si el día ya está cerrado, se muestran sus operaciones con el TC con que se cerró.
    const { resumen } = existente
      ? await this.resumenDia(fecha, existente.tcCierre.toString(), existente.id)
      : await this.resumenDia(fecha, tcCierre ?? '0');
    const sugerido = anterior ? anterior.cajaContadaUsd.toFixed(2) : null;
    const inicial = saldoInicialUsd ?? sugerido ?? '0';

    return {
      ...resumen,
      saldoInicialSugeridoUsd: sugerido,
      saldoInicialUsd: new Decimal(inicial).toFixed(2),
      posicionEsperadaUsd: this.posicionEsperada(inicial, resumen).toFixed(2),
      cierreExistenteId: existente?.id ?? null,
    };
  }

  /** Crea un cierre en estado "borrador" agregando las operaciones finalizadas del día. */
  async create(dto: CreateCierreDto, operadorCierreId: string): Promise<CierreConSaldos> {
    const existing = await this.prisma.cierre.findUnique({ where: { fecha: dto.fecha } });
    if (existing) {
      throw new BadRequestException(`Ya existe un cierre para la fecha ${dto.fecha.toISOString()}`);
    }

    const operador = await this.prisma.usuario.findUnique({ where: { id: operadorCierreId } });
    if (!operador) throw new BadRequestException('Operador no encontrado');

    // #12: la caja contada es la suma de los saldos reales cargados en USD.
    let cajaContada: Decimal;
    if (dto.saldosReales) {
      cajaContada = dto.saldosReales.reduce((acc, s) => acc.plus(s.montoUsd), new Decimal(0));
      if (dto.cajaContadaUsd !== undefined && !new Decimal(dto.cajaContadaUsd).eq(cajaContada)) {
        throw new BadRequestException(
          `cajaContadaUsd (${dto.cajaContadaUsd}) no coincide con la suma de los saldos reales (${cajaContada.toFixed(2)})`,
        );
      }
    } else {
      cajaContada = new Decimal(dto.cajaContadaUsd as string);
    }

    const { resumen, opIds, gastoIds, cableIds, usdtIds, saldoMovIds, ops, paresInput, tcCierre } =
      await this.resumenDia(dto.fecha, dto.tcCierre);
    const posicionEsperadaUsd = this.posicionEsperada(dto.saldoInicialUsd, resumen);
    const diferenciaUsd = cajaContada.minus(posicionEsperadaUsd);

    return this.prisma.$transaction(async (tx) => {
      const cierre = await tx.cierre.create({
        data: {
          fecha: dto.fecha,
          estado: 'borrador',
          operadorCierreId,
          operadorCierreNombre: operador.nombre,
          tcCierre: dto.tcCierre,
          saldoInicialUsd: dto.saldoInicialUsd,
          cajaContadaUsd: cajaContada.toFixed(2),
          posicionEsperadaUsd: posicionEsperadaUsd.toFixed(2),
          diferenciaUsd: diferenciaUsd.toFixed(2),
          gananciaRealizadaUsd: resumen.gananciaRealizadaUsd,
          exposicionAbiertaUsd: '0',
          netoAbiertoUsd: '0',
          totalComisionesUsd: resumen.totalComisionesUsd,
          totalGastosArs: resumen.totalGastosArs,
          totalGastosUsd: resumen.totalGastosUsd,
          resultadoOperativoUsd: resumen.resultadoOperativoUsd,
          gananciaCablesUsd: resumen.totalCables.gananciaUsd,
          gananciaUsdtUsd: resumen.totalUsdt.gananciaUsd,
          deudaJefeUsd: resumen.deudaJefeUsd,
          volumenTotalUsd: resumen.volumenTotalUsd,
          nOps: resumen.nOpsFinalizadas,
          notas: dto.notas ?? undefined,
          saldosReales: dto.saldosReales
            ? {
                create: dto.saldosReales.map((s, i) => ({
                  orden: i,
                  moneda: s.moneda,
                  montoUsd: s.montoUsd,
                  detalle: s.detalle || null,
                })),
              }
            : undefined,
        },
        include: { saldosReales: { orderBy: { orden: 'asc' } } },
      });

      if (opIds.length > 0) {
        await tx.operacion.updateMany({
          where: { id: { in: opIds } },
          data: { cierreId: cierre.id },
        });
      }
      // #13: cables, USDT y gastos del día quedan ligados (e inmutables) al cierre.
      if (cableIds.length > 0) await tx.cable.updateMany({ where: { id: { in: cableIds } }, data: { cierreId: cierre.id } });
      if (usdtIds.length > 0) await tx.usdtOperacion.updateMany({ where: { id: { in: usdtIds } }, data: { cierreId: cierre.id } });
      if (gastoIds.length > 0) await tx.gasto.updateMany({ where: { id: { in: gastoIds } }, data: { cierreId: cierre.id } });
      // #19: los movimientos de saldo del día quedan ligados al cierre, y se guarda la foto de saldos.
      if (saldoMovIds.length > 0) {
        await tx.clienteSaldoMovimiento.updateMany({ where: { id: { in: saldoMovIds } }, data: { cierreId: cierre.id } });
      }
      await this.fotoSaldosClientes(tx, cierre.id, dto.fecha, ops, paresInput, tcCierre);

      return cierre;
    });
  }

  /**
   * #19 — Saldo de cada cliente al abrir y al cerrar el día. Entra todo cliente con saldo
   * distinto de cero o con movimientos en el día. El saldo al cierre descuenta los
   * movimientos posteriores al día (por si el cierre se hace más tarde).
   */
  private async fotoSaldosClientes(
    tx: Prisma.TransactionClient,
    cierreId: string,
    fecha: Date,
    ops: Array<{ clienteId: string | null; parId: string; contra: Prisma.Decimal }>,
    paresInput: Array<{ par: string; base: string; quote: string; compra: string; venta: string }>,
    tcCierre: Decimal,
  ) {
    const { startOfDay, endOfDay } = rangoDelDia(fecha);
    const clientes = await tx.cliente.findMany({
      where: { OR: [{ saldoUsd: { not: 0 } }, { saldoMovimientos: { some: { ts: { gte: startOfDay } } } }] },
      include: { saldoMovimientos: { where: { ts: { gte: startOfDay } }, select: { ts: true, montoUsd: true } } },
    });
    // montoUsd ya viene con signo (débito < 0).
    const delta = (movs: Array<{ montoUsd: Prisma.Decimal }>) =>
      movs.reduce((acc, m) => acc.plus(m.montoUsd.toString()), new Decimal(0));
    const filas = clientes.flatMap((c) => {
      const delDia = c.saldoMovimientos.filter((m) => m.ts <= endOfDay);
      const posteriores = c.saldoMovimientos.filter((m) => m.ts > endOfDay);
      const cierre = new Decimal(c.saldoUsd.toString()).minus(delta(posteriores));
      const deltaDia = delta(delDia);
      if (cierre.isZero() && delDia.length === 0) return [];
      const opsCliente = ops.filter((o) => o.clienteId === c.id);
      const volumen = opsCliente.reduce((acc, o) => {
        const quote = paresInput.find((p) => p.par === o.parId)?.quote ?? 'USD';
        return acc.plus(toUsd(new Decimal(o.contra.toString()), quote, paresInput, tcCierre));
      }, new Decimal(0));
      return [{
        cierreId,
        clienteId: c.id,
        clienteNombre: c.apellido ? `${c.nombre} ${c.apellido}` : c.nombre,
        custodia: custodiaDe(c.custodia),
        saldoUsdApertura: cierre.minus(deltaDia).toFixed(2),
        saldoUsdCierre: cierre.toFixed(2),
        deltaUsd: deltaDia.toFixed(2),
        nOpsDia: opsCliente.length,
        volumenUsdDia: volumen.toFixed(2),
      }];
    });
    if (filas.length > 0) await tx.cierreSaldoCliente.createMany({ data: filas });
  }

  /** #19 — Datos del reporte de cierre para el jefe (ganancias, saldo de caja, saldos de clientes y balance). */
  async reporte(id: string): Promise<ReporteCierre> {
    const c = await this.prisma.cierre.findUnique({
      where: { id },
      include: { saldosCliente: { orderBy: { clienteNombre: 'asc' } } },
    });
    if (!c) throw new NotFoundException(`Cierre ${id} no encontrado`);
    const D0 = new Decimal(0);
    const saldosClientes = c.saldosCliente
      .filter((s) => !s.saldoUsdCierre.isZero())
      .map((s) => ({
        clienteId: s.clienteId,
        clienteNombre: s.clienteNombre,
        custodia: s.custodia,
        saldoUsdApertura: s.saldoUsdApertura.toFixed(2),
        saldoUsdCierre: s.saldoUsdCierre.toFixed(2),
        deltaUsd: s.deltaUsd.toFixed(2),
      }));
    const total = (custodia: string) =>
      saldosClientes.filter((s) => s.custodia === custodia).reduce((acc, s) => acc.plus(s.saldoUsdCierre), D0);
    const totalCaja = total('caja');
    const gananciaCambio = new Decimal(c.gananciaRealizadaUsd.toString()).minus(c.totalComisionesUsd.toString());
    const gananciaTotal = gananciaCambio.plus(c.gananciaCablesUsd.toString()).plus(c.gananciaUsdtUsd.toString());
    return {
      fecha: c.fecha.toISOString(),
      estado: c.estado,
      gananciaCambioUsd: gananciaCambio.toFixed(2),
      gananciaCablesUsd: c.gananciaCablesUsd.toFixed(2),
      gananciaUsdtUsd: c.gananciaUsdtUsd.toFixed(2),
      gananciaTotalUsd: gananciaTotal.toFixed(2),
      totalGastosUsd: c.totalGastosUsd.toFixed(2),
      resultadoOperativoUsd: c.resultadoOperativoUsd.toFixed(2),
      cajaContadaUsd: c.cajaContadaUsd.toFixed(2),
      posicionEsperadaUsd: c.posicionEsperadaUsd.toFixed(2),
      diferenciaUsd: c.diferenciaUsd.toFixed(2),
      saldosClientes,
      totalSaldosCajaUsd: totalCaja.toFixed(2),
      totalSaldosSeparadosUsd: total('separada').toFixed(2),
      balanceUsd: new Decimal(c.cajaContadaUsd.toString()).minus(totalCaja).toFixed(2),
    };
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

  async findOne(id: string): Promise<CierreConSaldos> {
    const c = await this.prisma.cierre.findUnique({
      where: { id },
      include: { saldosReales: { orderBy: { orden: 'asc' } } },
    });
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
