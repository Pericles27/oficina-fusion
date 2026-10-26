import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateEticketDto, UpdateEticketDto, TramoInput } from './dto/eticket.dto';
import { EticketTramo, EticketEstado, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';

/**
 * Lista blanca de campos que un CADETE puede ver. `select` explícito:
 * si mañana se agrega un campo sensible al modelo (ej. `comisionUsd`),
 * NO aparece acá automáticamente — hay que agregarlo a mano. Es la
 * diferencia entre lista blanca y lista negra (ver ANALISIS-FASES-3-4-5.md
 * §1 sobre el riesgo de usar destructuring para "sacar" campos).
 *
 * Decisión U5 (Nicolás, 2026-10-16; regla 4 de CLAUDE.md): el cadete ve
 * instrucciones operativas de la visita y, por tramo, cuánto deja, cuánto
 * se lleva y a qué cuenta deposita. NUNCA ve la operación ni nada derivado
 * de ella (cotiz, clientRate, marketRateId, puntos, contra), comisión,
 * spread, ganancia, reparto/operador dueño ni saldos. Las columnas legado
 * (banco, cuentaDeposito, monto/moneda Entregar/Recibir) no se exponen: la
 * fuente de verdad son los tramos.
 */
const ETICKET_CADETE_SELECT = {
  id: true,
  numero: true,
  codigo: true,
  ts: true,
  estado: true,
  clienteId: true,
  metodoEntrega: true,
  direccionEntrega: true,
  telefonoContacto: true,
  nombreRecibe: true,
  horarioEntrega: true,
  instrucciones: true,
  confirmadoPor: true,
  confirmadoEn: true,
  creadoEn: true,
  tramos: {
    orderBy: { orden: 'asc' },
    select: {
      orden: true, sentido: true, canal: true, moneda: true, monto: true,
      depBeneficiario: true, depCuit: true, depBanco: true, depTipoCuenta: true, depMonedaCuenta: true,
      depNumeroCuenta: true, depCbu: true, depAlias: true,
    },
  },
} satisfies Prisma.EticketSelect;

// Explicit admin projection: never expose/write deprecated economic columns.
const ETICKET_ADMIN_SELECT = {
  id: true, numero: true, codigo: true, ts: true, operationId: true, clienteId: true,
  estado: true, metodoEntrega: true, direccionEntrega: true, telefonoContacto: true,
  nombreRecibe: true, horarioEntrega: true, instrucciones: true, confirmadoPor: true,
  confirmadoEn: true, creadoPor: true, creadoEn: true, createdAt: true, updatedAt: true,
  tramos: { orderBy: { orden: 'asc' } },
} satisfies Prisma.EticketSelect;

const emptySnapshot = {
  depBeneficiario: null, depCuit: null, depBanco: null, depNumeroCuenta: null,
  depCbu: null, depAlias: null, depTipoCuenta: null, depMonedaCuenta: null,
};

@Injectable()
export class ETicketsService {
  constructor(private prisma: PrismaService) {}

  private async validateHeader(tx: Prisma.TransactionClient, clienteId: string, operationId?: string | null, id?: string) {
    const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new BadRequestException(`Cliente ${clienteId} no existe`);
    if (operationId) {
      const op = await tx.operacion.findUnique({ where: { id: operationId } });
      if (!op) throw new BadRequestException(`Operación ${operationId} no existe`);
      const used = await tx.eticket.findUnique({ where: { operationId }, select: { id: true } });
      if (used && used.id !== id) throw new BadRequestException('Operación ya vinculada a un e-ticket');
    }
  }

  private header(dto: UpdateEticketDto) {
    return {
      clienteId: dto.clienteId, operationId: dto.operationId,
      direccionEntrega: dto.direccionEntrega, telefonoContacto: dto.telefonoContacto,
      nombreRecibe: dto.nombreRecibe, horarioEntrega: dto.horarioEntrega,
      instrucciones: dto.instrucciones,
    };
  }

  private normalizeDireccion(direccion?: string | null): string | null {
    return direccion && direccion.trim() ? direccion : null;
  }

  private delivery(tramos: Array<{ canal: string }>, direccion?: string | null) {
    if (!tramos.length) throw new BadRequestException('Se requiere al menos un tramo');
    const cash = tramos.some((t) => t.canal === 'EFECTIVO');
    const deposit = tramos.some((t) => t.canal === 'DEPOSITO');
    if (cash !== Boolean(direccion?.trim())) {
      throw new BadRequestException('Dirección requerida si y sólo si hay EFECTIVO');
    }
    return cash ? (deposit ? 'mixto' : 'en_mano') : 'deposito_banco';
  }

  /**
   * U7 (Nicolás, 2026-10-25), opción (a): los tramos de un e-ticket vinculado a una
   * operación suman exactamente lo que la operación entrega y recibe; si no, no se guarda.
   * Compra (C): la oficina recibe `monto` en base y entrega `contra` en quote; venta (V) al revés.
   * Con cobertura `saldo` (#19) la pata en USD se liquida contra el saldo del cliente y no
   * lleva tramos.
   */
  private async reconcile(tx: Prisma.TransactionClient, operationId: string | null | undefined, tramos: Array<{ sentido: string; moneda: string; monto: Prisma.Decimal | string }>) {
    if (!operationId) return;
    const op = await tx.operacion.findUnique({ where: { id: operationId }, include: { par: true } });
    if (!op) throw new BadRequestException(`Operación ${operationId} no existe`);
    const base = { moneda: op.par.base, monto: new Decimal(op.monto.toString()) };
    const quote = { moneda: op.par.quote, monto: new Decimal(op.contra.toString()) };
    const patas = [
      { sentido: 'RETIRO', ...(op.tipo === 'C' ? base : quote) },
      { sentido: 'ENTREGA', ...(op.tipo === 'C' ? quote : base) },
    ].filter((p) => !(op.cobertura === 'saldo' && p.moneda === 'USD'));
    const label = (sentido: string) => (sentido === 'ENTREGA' ? 'dejar' : 'retirar');
    for (const t of tramos) {
      if (!patas.some((p) => p.sentido === t.sentido && p.moneda === t.moneda)) {
        throw new BadRequestException(`El tramo para ${label(t.sentido)} ${t.moneda} no corresponde a la operación ${op.codigo}`);
      }
    }
    for (const p of patas) {
      const suma = tramos
        .filter((t) => t.sentido === p.sentido && t.moneda === p.moneda)
        .reduce((acc, t) => acc.plus(t.monto.toString()), new Decimal(0));
      if (!suma.eq(p.monto)) {
        throw new BadRequestException(
          `Los tramos para ${label(p.sentido)} ${p.moneda} suman ${suma.toFixed()} y la operación ${op.codigo} es de ${p.monto.toFixed()}`,
        );
      }
    }
  }

  private async prepareTramos(tx: Prisma.TransactionClient, clienteId: string, inputs: TramoInput[], previous: EticketTramo[]) {
    if (!inputs.length) throw new BadRequestException('Se requiere al menos un tramo');
    const ids = new Set<string>();
    const orders = new Set<number>();
    const result: Array<{ id?: string; data: Prisma.EticketTramoUncheckedCreateWithoutEticketInput }> = [];
    for (const input of inputs) {
      const old = input.id ? previous.find((t) => t.id === input.id) : undefined;
      if (input.id && (!old || ids.has(input.id))) throw new BadRequestException('ID de tramo ajeno o duplicado');
      if (input.id) ids.add(input.id);
      if (orders.has(input.orden)) throw new BadRequestException('Orden de tramo duplicado');
      orders.add(input.orden);
      const data: Prisma.EticketTramoUncheckedCreateWithoutEticketInput = {
        orden: input.orden, sentido: input.sentido, canal: input.canal,
        moneda: input.moneda, monto: input.monto, cuentaDestinoId: null, ...emptySnapshot,
      };
      if (input.canal === 'DEPOSITO') {
        // U6 (Nicolás, 2026-10-25): la oficina no recibe depósitos; el cliente siempre entrega efectivo.
        if (input.sentido === 'RETIRO') throw new BadRequestException('La oficina no recibe depósitos: un retiro es siempre en efectivo');
        const cuentaId = input.cuentaDestinoId === undefined ? old?.cuentaDestinoId : input.cuentaDestinoId;
        if (!cuentaId) throw new BadRequestException('DEPOSITO requiere cuentaDestinoId');
        // Ownership is checked even when preserving the historical snapshot; never
        // copy fresh account details unless this is a new tramo or changed account.
        const preserve = old?.canal === 'DEPOSITO' && old.cuentaDestinoId === cuentaId;
        const cuenta = await tx.cuentaCliente.findUnique({ where: { id: cuentaId }, select: {
          clienteId: true, titular: !preserve, cuitTitular: !preserve, banco: !preserve,
          numeroCuenta: !preserve, cbu: !preserve, alias: !preserve, tipoCuenta: !preserve, monedaCuenta: !preserve,
        } });
        if (!cuenta || cuenta.clienteId !== clienteId) throw new BadRequestException('Cuenta de otro cliente o inexistente');
        const snapshot = preserve
          ? { depBeneficiario: old.depBeneficiario, depCuit: old.depCuit, depBanco: old.depBanco,
              depNumeroCuenta: old.depNumeroCuenta, depCbu: old.depCbu, depAlias: old.depAlias, depTipoCuenta: old.depTipoCuenta,
              depMonedaCuenta: old.depMonedaCuenta }
          : { depBeneficiario: cuenta.titular, depCuit: cuenta.cuitTitular, depBanco: cuenta.banco,
              depNumeroCuenta: cuenta.numeroCuenta, depCbu: cuenta.cbu, depAlias: cuenta.alias, depTipoCuenta: cuenta.tipoCuenta,
              depMonedaCuenta: cuenta.monedaCuenta };
        const combined = { ...snapshot, ...input.depOverrides };
        if (combined.depCbu !== null && !/^[0-9]{22}$/.test(combined.depCbu)) throw new BadRequestException('CBU debe tener 22 dígitos');
        if (![combined.depCbu, combined.depNumeroCuenta, combined.depAlias].some((v) => v?.trim())) {
          throw new BadRequestException('Depósito requiere al menos un identificador');
        }
        Object.assign(data, combined, { cuentaDestinoId: cuentaId });
      }
      result.push({ id: input.id, data });
    }
    return result;
  }

  async create(dto: CreateEticketDto, creadoPor: string) {
    return this.prisma.$transaction(async (tx) => {
      // Transaction-scoped allocation lock: concurrent creates cannot choose the same numero.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(2147483000)`;
      await this.validateHeader(tx, dto.clienteId, dto.operationId);
      const prepared = await this.prepareTramos(tx, dto.clienteId, dto.tramos, []);
      const direccionEntrega = this.normalizeDireccion(dto.direccionEntrega);
      const metodoEntrega = this.delivery(dto.tramos, direccionEntrega);
      await this.reconcile(tx, dto.operationId, dto.tramos);
      const last = await tx.eticket.findFirst({ orderBy: { numero: 'desc' }, select: { numero: true } });
      const numero = (last?.numero ?? 0) + 1;
      return tx.eticket.create({
        data: { ...this.header(dto), clienteId: dto.clienteId, numero,
          codigo: `ET-${String(numero).padStart(4, '0')}`, metodoEntrega, direccionEntrega, creadoPor,
          tramos: { create: prepared.map((t) => t.data) } },
        select: ETICKET_ADMIN_SELECT,
      });
    });
  }

  async findAll(params: {
    estado?: string;
    clienteId?: string;
    operationId?: string;
    page?: number;
    pageSize?: number;
    scopeCadete?: boolean;
  }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const where: Prisma.EticketWhereInput = {};

    if (params.scopeCadete) {
      // F5 (R1): un cadete SOLO ve e-tickets pendientes y NUNCA campos
      // económicos. Ignora el filtro de `estado` que venga del cliente —
      // el scope es fijo para este rol, no negociable por query param.
      where.estado = 'pendiente';
      const [data, total] = await Promise.all([
        this.prisma.eticket.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { ts: 'desc' },
          select: ETICKET_CADETE_SELECT,
        }),
        this.prisma.eticket.count({ where }),
      ]);
      return { data, total, page, pageSize };
    }

    if (params.estado) where.estado = params.estado as EticketEstado;
    if (params.clienteId) where.clienteId = params.clienteId;
    if (params.operationId) where.operationId = params.operationId;

    const [data, total] = await Promise.all([
      this.prisma.eticket.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { ts: 'desc' },
        select: ETICKET_ADMIN_SELECT,
      }),
      this.prisma.eticket.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(id: string) {
    const et = await this.prisma.eticket.findUnique({ where: { id }, select: ETICKET_ADMIN_SELECT });
    if (!et) throw new NotFoundException(`E-Ticket ${id} no encontrado`);
    return et;
  }

  /**
   * Vista para el cadete: NUNCA incluye datos económicos (montoEntregar/
   * montoRecibir/monedas). `select` explícito, no destructuring — con
   * destructuring, un campo nuevo en el modelo aparece en la respuesta
   * automáticamente y el código compila igual (fuga silenciosa).
   */
  async findOneForCadete(id: string) {
    const et = await this.prisma.eticket.findUnique({
      where: { id },
      select: ETICKET_CADETE_SELECT,
    });
    if (!et) throw new NotFoundException(`E-Ticket ${id} no encontrado`);
    if (et.estado !== 'pendiente') throw new NotFoundException(`E-Ticket ${id} no encontrado`);
    return et;
  }

  async update(id: string, dto: UpdateEticketDto) {
    return this.prisma.$transaction(async (tx) => {
      // Serialize edits with state transitions too (UPDATE takes the same row lock).
      await tx.$queryRaw`SELECT id FROM eticket WHERE id = ${id} FOR UPDATE`;
      const old = await tx.eticket.findUnique({ where: { id }, include: { tramos: true } });
      if (!old) throw new NotFoundException(`E-Ticket ${id} no encontrado`);
      if (old.estado !== 'pendiente') throw new ConflictException('Sólo se puede editar un e-ticket pendiente');
      const clienteId = dto.clienteId ?? old.clienteId;
      const operationId = dto.operationId === undefined ? old.operationId : dto.operationId;
      await this.validateHeader(tx, clienteId, operationId, id);
      const resulting = dto.tramos ?? old.tramos;
      const direccion = this.normalizeDireccion(dto.direccionEntrega === undefined ? old.direccionEntrega : dto.direccionEntrega);
      const metodoEntrega = this.delivery(resulting, direccion);
      await this.reconcile(tx, operationId, resulting);
      if (dto.tramos !== undefined) {
        const prepared = await this.prepareTramos(tx, clienteId, dto.tramos, old.tramos);
        const kept = prepared.flatMap((t) => t.id ? [t.id] : []);
        await tx.eticketTramo.deleteMany({ where: { eticketId: id, id: { notIn: kept } } });
        // Park retained IDs in free positive slots absent from BOTH order sets.
        // This also supports valid int32 maximum orders without overflow.
        const occupied = new Set([...old.tramos.map((t) => t.orden), ...dto.tramos.map((t) => t.orden)]);
        let temporaryOrder = 1;
        for (const tramoId of kept) {
          while (occupied.has(temporaryOrder)) temporaryOrder++;
          occupied.add(temporaryOrder);
          await tx.eticketTramo.update({ where: { id: tramoId }, data: { orden: temporaryOrder } });
        }
        for (const item of prepared) {
          if (item.id) await tx.eticketTramo.update({ where: { id: item.id }, data: item.data });
          else await tx.eticketTramo.create({ data: { ...item.data, eticketId: id } });
        }
      } else if (clienteId !== old.clienteId) {
        for (const tramo of old.tramos) {
          if (tramo.cuentaDestinoId) {
            const cuenta = await tx.cuentaCliente.findUnique({ where: { id: tramo.cuentaDestinoId } });
            if (!cuenta || cuenta.clienteId !== clienteId) throw new BadRequestException('Cuenta de otro cliente');
          }
        }
      }
      return tx.eticket.update({ where: { id }, data: { ...this.header(dto), metodoEntrega, direccionEntrega: direccion }, select: ETICKET_ADMIN_SELECT });
    });
  }

  async confirm(id: string, confirmadoPor: string) {
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
      // This route is also accessible to CADETE: answer with the cadete whitelist.
      select: ETICKET_CADETE_SELECT,
    });
  }

  async cancel(id: string) {
    const et = await this.findOne(id);
    if (et.estado === 'confirmado') {
      throw new BadRequestException('No se puede cancelar un e-ticket ya confirmado');
    }
    return this.prisma.eticket.update({
      where: { id },
      data: { estado: 'cancelado' },
      select: ETICKET_ADMIN_SELECT,
    });
  }
}
