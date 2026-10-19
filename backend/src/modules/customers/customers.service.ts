import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/create-customer.dto';
import { SaldoAdjustmentDto } from './dto/saldo-adjustment.dto';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { Cliente, ClienteDireccion, Prisma } from '@prisma/client';
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

  // =========================================================
  // DIRECCIONES — CRUD anidado a cliente
  // =========================================================

  /**
   * Crea una dirección anidada a un cliente.
   * clienteId proviene exclusivamente del path param; se ignora cualquier
   * campo clienteId que llegara en el body (si existiera).
   * Whitelist exacta: direccion, tipo, ciudad, provincia, codigoPost, principal.
   */
  async createAddress(clienteId: string, dto: CreateAddressDto): Promise<ClienteDireccion> {
    await this.findOne(clienteId);

    return this.prisma.clienteDireccion.create({
      data: {
        clienteId,
        direccion: dto.direccion,
        tipo: dto.tipo ?? null,
        ciudad: dto.ciudad ?? null,
        provincia: dto.provincia ?? null,
        codigoPost: dto.codigoPost ?? null,
        principal: dto.principal ?? false,
      },
    });
  }

  /**
   * Lista todas las direcciones de un cliente.
   */
  async findAddresses(clienteId: string): Promise<Prisma.ClienteDireccionGetPayload<{}>[]> {
    await this.findOne(clienteId);

    return this.prisma.clienteDireccion.findMany({
      where: { clienteId },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Devuelve detalle de una dirección específica de un cliente.
   * Verifica ownership: solo retorna si direccion.clienteId == clienteId.
   */
  async findAddress(clienteId: string, addressId: string): Promise<Prisma.ClienteDireccionGetPayload<{}>> {
    await this.findOne(clienteId);

    const address = await this.prisma.clienteDireccion.findFirst({
      where: {
        id: addressId,
        clienteId,
      },
    });

    if (!address) {
      throw new NotFoundException('Dirección no encontrada para este cliente');
    }

    return address;
  }

  /**
   * Actualiza una dirección existente de un cliente.
   * Whitelist exacta de campos: direccion, tipo, ciudad, provincia, codigoPost, principal.
   * Verifica ownership estricta: solo se actualiza si direccion.clienteId == clienteId.
   * Persiste el valor existente de cada campo si no fue provisto en el DTO.
   */
  async updateAddress(
    clienteId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<Prisma.ClienteDireccionGetPayload<{}>> {
    await this.findOne(clienteId);

    const existing = await this.prisma.clienteDireccion.findFirst({
      where: {
        id: addressId,
        clienteId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Dirección no encontrada para este cliente');
    }

    return this.prisma.clienteDireccion.update({
      where: { id: addressId },
      data: {
        direccion: dto.direccion ?? existing.direccion,
        tipo: dto.tipo !== undefined ? dto.tipo : existing.tipo,
        ciudad: dto.ciudad !== undefined ? dto.ciudad : existing.ciudad,
        provincia: dto.provincia !== undefined ? dto.provincia : existing.provincia,
        codigoPost: dto.codigoPost !== undefined ? dto.codigoPost : existing.codigoPost,
        principal:
          dto.principal !== undefined ? dto.principal : existing.principal,
      },
    });
  }

  /**
   * Elimina una dirección de un cliente (hard delete).
   * Verifica ownership estricta. No hay FK con onDelete SET NULL en
   * otros modelos, por lo que la eliminación es segura.
   */
  async deleteAddress(clienteId: string, addressId: string): Promise<void> {
    await this.findOne(clienteId);

    const existing = await this.prisma.clienteDireccion.findFirst({
      where: {
        id: addressId,
        clienteId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Dirección no encontrada para este cliente');
    }

    await this.prisma.clienteDireccion.delete({
      where: { id: addressId },
    });
  }

  // =========================================================
  // CUENTAS — CRUD anidado a cliente
  // =========================================================

  /**
   * Crea una cuenta bancaria anidada a un cliente.
   * Verifica ownership: la cuenta siempre se escribe con el clienteId del
   * path param; se rechaza si cliente no existe. No se usa clienteId del
   * body (si llegara, se ignora).
   */
  async createAccount(clienteId: string, dto: CreateAccountDto) {
    await this.findOne(clienteId);

    return this.prisma.cuentaCliente.create({
      data: {
        clienteId,
        banco: dto.banco,
        tipo: dto.tipo ?? null,
        numero: dto.numero,
        titular: dto.titular ?? null,
        activo: dto.activo ?? true,
        tipoCuenta: dto.tipoCuenta ?? null,
        monedaCuenta: dto.monedaCuenta,
        numeroCuenta: dto.numeroCuenta ?? null,
        cbu: dto.cbu ?? null,
        alias: dto.alias ?? null,
        cuitTitular: dto.cuitTitular ?? null,
      },
    });
  }

  /**
   * Lista todas las cuentas de un cliente.
   */
  async findAccounts(clienteId: string): Promise<Prisma.CuentaClienteGetPayload<{}>[]> {
    await this.findOne(clienteId);

    return this.prisma.cuentaCliente.findMany({
      where: { clienteId },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Devuelve detalle de una cuenta específica de un cliente.
   * Verifica ownership: solo se retorna si cuenta.clienteId == clienteId.
   */
  async findAccount(clienteId: string, accountId: string): Promise<Prisma.CuentaClienteGetPayload<{}>> {
    await this.findOne(clienteId);

    const account = await this.prisma.cuentaCliente.findFirst({
      where: {
        id: accountId,
        clienteId,
      },
    });

    if (!account) {
      throw new NotFoundException('Cuenta no encontrada para este cliente');
    }

    return account;
  }

  /**
   * Actualiza una cuenta existente de un cliente.
   * Verifica ownership estricta: solo se actualiza si cuenta.clienteId == clienteId.
   */
  async updateAccount(clienteId: string, accountId: string, dto: UpdateAccountDto) {
    await this.findOne(clienteId);

    const existing = await this.prisma.cuentaCliente.findFirst({
      where: {
        id: accountId,
        clienteId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Cuenta no encontrada para este cliente');
    }

    return this.prisma.cuentaCliente.update({
      where: { id: accountId },
      data: {
        banco: dto.banco ?? existing.banco,
        tipo: dto.tipo !== undefined ? dto.tipo : existing.tipo,
        numero: dto.numero ?? existing.numero,
        titular: dto.titular !== undefined ? dto.titular : existing.titular,
        activo: dto.activo !== undefined ? dto.activo : existing.activo,
        tipoCuenta: dto.tipoCuenta !== undefined ? dto.tipoCuenta : existing.tipoCuenta,
        monedaCuenta: dto.monedaCuenta ?? existing.monedaCuenta,
        numeroCuenta: dto.numeroCuenta !== undefined ? dto.numeroCuenta : existing.numeroCuenta,
        cbu: dto.cbu !== undefined ? dto.cbu : existing.cbu,
        alias: dto.alias !== undefined ? dto.alias : existing.alias,
        cuitTitular: dto.cuitTitular !== undefined ? dto.cuitTitular : existing.cuitTitular,
      },
    });
  }

  /**
   * Desactiva una cuenta (soft delete).
   * Verifica ownership estricta.
   */
  async deleteAccount(clienteId: string, accountId: string): Promise<void> {
    await this.findOne(clienteId);

    const existing = await this.prisma.cuentaCliente.findFirst({
      where: {
        id: accountId,
        clienteId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Cuenta no encontrada para este cliente');
    }

    // Soft delete: marcar inactivo, no hard delete para preservar referencias
    // de e-ticket tramos (FK con onDelete SET NULL).
    await this.prisma.cuentaCliente.update({
      where: { id: accountId },
      data: { activo: false },
    });
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
