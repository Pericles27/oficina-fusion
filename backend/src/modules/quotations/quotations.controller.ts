import { Controller, Get, Put, Body, Param, UseGuards, UsePipes } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { UpdateQuotationSchema, UpdateQuotationDto } from './dto/quotation.dto';

// F6 — alcance mínimo (PLAN-PRODUCCION.md §FASE 6): GET es de lectura para
// cualquier rol autenticado (la UI de cotizaciones la ven ADMIN y OPERADOR,
// y no hay dato sensible acá); el PUT que mueve la cotización del día queda
// cerrado a ADMIN/OPERADOR, igual que operations.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotations')
export class QuotationsController {
  constructor(private quotationsService: QuotationsService) {}

  @Get()
  findAll() {
    return this.quotationsService.findAll();
  }

  @Put(':par')
  @Roles(RolUsuario.ADMIN, RolUsuario.OPERADOR)
  @UsePipes(new ZodValidationPipe(UpdateQuotationSchema))
  update(@Param('par') par: string, @Body() dto: UpdateQuotationDto) {
    return this.quotationsService.update(par, dto);
  }
}
