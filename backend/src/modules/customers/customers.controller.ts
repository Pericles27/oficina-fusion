import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  createCustomerSchema,
  updateCustomerSchema,
  CreateCustomerDto,
  UpdateCustomerDto,
} from './dto/create-customer.dto';
import { saldoAdjustmentSchema, SaldoAdjustmentDto } from './dto/saldo-adjustment.dto';
import {
  createAccountSchema,
  updateAccountSchema,
  CreateAccountDto,
  UpdateAccountDto,
} from './dto/account.dto';
import {
  createAddressSchema,
  updateAddressSchema,
  CreateAddressDto,
  UpdateAddressDto,
} from './dto/address.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Post()
  @Roles(RolUsuario.ADMIN)
  @UsePipes(new ZodValidationPipe(createCustomerSchema))
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Get()
  findAll(
    @Query('q') q?: string,
    @Query('activo') activo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.customersService.findAll({
      q,
      activo: activo === undefined ? undefined : activo === 'true',
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Put(':id')
  @Roles(RolUsuario.ADMIN)
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateCustomerSchema)) dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  @Post(':id/saldo')
  @Roles(RolUsuario.ADMIN)
  adjustSaldo(@Param('id') id: string, @Body(new ZodValidationPipe(saldoAdjustmentSchema)) dto: SaldoAdjustmentDto) {
    return this.customersService.adjustSaldo(id, dto);
  }

  // =========================================================
  // DIRECCIONES — Endpoints anidados a /customers/:id/addresses
  // =========================================================

  /**
   * POST /customers/:id/addresses
   * Crear dirección para un cliente. Solo ADMIN.
   * El clienteId proviene exclusivamente del path param.
   */
  @Post(':id/addresses')
  @Roles(RolUsuario.ADMIN)
  createAddress(@Param('id') id: string, @Body(new ZodValidationPipe(createAddressSchema)) dto: CreateAddressDto) {
    return this.customersService.createAddress(id, dto);
  }

  /**
   * GET /customers/:id/addresses
   * Listar direcciones de un cliente. ADMIN o OPERADOR.
   */
  @Get(':id/addresses')
  @Roles(RolUsuario.ADMIN, RolUsuario.OPERADOR)
  listAddresses(@Param('id') id: string) {
    return this.customersService.findAddresses(id);
  }

  /**
   * GET /customers/:id/addresses/:addressId
   * Detalle de dirección de un cliente. ADMIN o OPERADOR.
   * Verifica ownership: solo devuelve si direccion.clienteId == id.
   */
  @Get(':id/addresses/:addressId')
  @Roles(RolUsuario.ADMIN, RolUsuario.OPERADOR)
  findAddress(@Param('id') id: string, @Param('addressId') addressId: string) {
    return this.customersService.findAddress(id, addressId);
  }

  /**
   * PUT /customers/:id/addresses/:addressId
   * Actualizar dirección de un cliente. Solo ADMIN.
   * Verifica ownership estricta.
   */
  @Put(':id/addresses/:addressId')
  @Roles(RolUsuario.ADMIN)
  updateAddress(@Param('id') id: string, @Param('addressId') addressId: string, @Body(new ZodValidationPipe(updateAddressSchema)) dto: UpdateAddressDto) {
    return this.customersService.updateAddress(id, addressId, dto);
  }

  /**
   * DELETE /customers/:id/addresses/:addressId
   * Elimina dirección de un cliente. Solo ADMIN.
   * Hard delete (no FK con onDelete SET NULL en otros modelos).
   */
  @Delete(':id/addresses/:addressId')
  @Roles(RolUsuario.ADMIN)
  deleteAddress(@Param('id') id: string, @Param('addressId') addressId: string) {
    return this.customersService.deleteAddress(id, addressId);
  }

  // =========================================================
  // CUENTAS — Endpoints anidados a /customers/:id/accounts
  // =========================================================

  /**
   * POST /customers/:id/accounts
   * Crear cuenta para un cliente. Solo ADMIN.
   * La cuenta siempre se asocia al cliente del path param, no del body.
   */
  @Post(':id/accounts')
  @Roles(RolUsuario.ADMIN)
  createAccount(@Param('id') id: string, @Body(new ZodValidationPipe(createAccountSchema)) dto: CreateAccountDto) {
    return this.customersService.createAccount(id, dto);
  }

  /**
   * GET /customers/:id/accounts
   * Listar cuentas de un cliente. ADMIN o OPERADOR.
   */
  @Get(':id/accounts')
  @Roles(RolUsuario.ADMIN, RolUsuario.OPERADOR)
  listAccounts(@Param('id') id: string) {
    return this.customersService.findAccounts(id);
  }

  /**
   * GET /customers/:id/accounts/:accountId
   * Detalle de cuenta de un cliente. ADMIN o OPERADOR.
   * Verifica ownership: solo devuelve si cuenta.clienteId == id.
   */
  @Get(':id/accounts/:accountId')
  @Roles(RolUsuario.ADMIN, RolUsuario.OPERADOR)
  findAccount(@Param('id') id: string, @Param('accountId') accountId: string) {
    return this.customersService.findAccount(id, accountId);
  }

  /**
   * PUT /customers/:id/accounts/:accountId
   * Actualizar cuenta de un cliente. Solo ADMIN.
   * Verifica ownership estricta.
   */
  @Put(':id/accounts/:accountId')
  @Roles(RolUsuario.ADMIN)
  updateAccount(@Param('id') id: string, @Param('accountId') accountId: string, @Body(new ZodValidationPipe(updateAccountSchema)) dto: UpdateAccountDto) {
    return this.customersService.updateAccount(id, accountId, dto);
  }

  /**
   * DELETE /customers/:id/accounts/:accountId
   * Desactiva cuenta (soft delete). Solo ADMIN.
   * No hard delete para preservar FK de e-ticket tramos (SET NULL).
   */
  @Delete(':id/accounts/:accountId')
  @Roles(RolUsuario.ADMIN)
  deleteAccount(@Param('id') id: string, @Param('accountId') accountId: string) {
    return this.customersService.deleteAccount(id, accountId);
  }
}
