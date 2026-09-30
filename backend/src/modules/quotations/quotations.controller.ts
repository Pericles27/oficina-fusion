import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
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

  // El id del par es "BASE/QUOTE" (ej. "USD/ARS"): un único :par no matchea
  // porque Express no acepta '/' dentro de un segmento de ruta. Se recibe
  // en dos segmentos y se reconstruye acá.
  //
  // Nota: el pipe Zod va en el parámetro @Body, no en @UsePipes de método —
  // @UsePipes a nivel de método corre el mismo pipe sobre TODOS los
  // parámetros (incluidos los @Param), y un schema de objeto no puede
  // parsear un string suelto. Mismo bug preexistente (fuera de este
  // alcance) en customers.controller.ts:62 (`update`), sin test que lo
  // cubra hoy — lo reporto en el entregable, no lo toco acá.
  @Put(':base/:quote')
  @Roles(RolUsuario.ADMIN, RolUsuario.OPERADOR)
  update(
    @Param('base') base: string,
    @Param('quote') quote: string,
    @Body(new ZodValidationPipe(UpdateQuotationSchema)) dto: UpdateQuotationDto,
  ) {
    return this.quotationsService.update(`${base}/${quote}`, dto);
  }
}
