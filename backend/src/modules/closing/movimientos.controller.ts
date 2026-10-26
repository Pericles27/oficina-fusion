import { Body, Controller, Delete, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { RolUsuario } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { Roles } from '../auth/decorators/roles.decorator';
import { MovimientosService } from './movimientos.service';
import {
  CreateGastoDto,
  CreateGastoSchema,
  CreateMovimientoUsdDto,
  CreateMovimientoUsdSchema,
} from './dto/movimientos.dto';

/**
 * #13 — Cables, USDT y gastos del día (USD). Mismo alcance que el cierre:
 * ADMIN y OPERADOR los cargan; el listado viene en GET /closing/preview.
 * El pipe va en @Body (no @UsePipes) para no validar también los path params.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN, RolUsuario.OPERADOR)
@Controller('movimientos')
export class MovimientosController {
  constructor(private movimientos: MovimientosService) {}

  @Post('cables')
  createCable(
    @Body(new ZodValidationPipe(CreateMovimientoUsdSchema)) dto: CreateMovimientoUsdDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.movimientos.createCable(dto, req.user.id);
  }

  @Post('usdt')
  createUsdt(
    @Body(new ZodValidationPipe(CreateMovimientoUsdSchema)) dto: CreateMovimientoUsdDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.movimientos.createUsdt(dto, req.user.id);
  }

  @Post('gastos')
  createGasto(@Body(new ZodValidationPipe(CreateGastoSchema)) dto: CreateGastoDto) {
    return this.movimientos.createGasto(dto);
  }

  @Delete('cables/:id')
  @HttpCode(204)
  removeCable(@Param('id') id: string) {
    return this.movimientos.remove('cable', id);
  }

  @Delete('usdt/:id')
  @HttpCode(204)
  removeUsdt(@Param('id') id: string) {
    return this.movimientos.remove('usdt', id);
  }

  @Delete('gastos/:id')
  @HttpCode(204)
  removeGasto(@Param('id') id: string) {
    return this.movimientos.remove('gasto', id);
  }
}
