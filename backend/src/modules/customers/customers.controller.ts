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
  @UsePipes(new ZodValidationPipe(updateCustomerSchema))
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  @Post(':id/saldo')
  @Roles(RolUsuario.ADMIN)
  @UsePipes(new ZodValidationPipe(saldoAdjustmentSchema))
  adjustSaldo(@Param('id') id: string, @Body() dto: SaldoAdjustmentDto) {
    return this.customersService.adjustSaldo(id, dto);
  }
}
