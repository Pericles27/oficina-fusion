import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { OperationsService } from './operations.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  CreateOpSchema,
  UpdateOpSchema,
  OpFilterSchema,
  CreateOpDto,
  UpdateOpDto,
  OpFilterDto,
} from './dto/operations.dto';

// F2: `operations` estaba sólo en `auth` (cualquier rol autenticado), lo que
// permitía a un CADETE crear/ver/finalizar operaciones. Se cierra a
// ADMIN/OPERADOR a nivel de controller: no hay ningún endpoint de operaciones
// que un cadete deba poder tocar.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN, RolUsuario.OPERADOR)
@Controller('operations')
export class OperationsController {
  constructor(private operationsService: OperationsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateOpSchema))
  create(@Body() dto: CreateOpDto, @Req() req: Request & { user: { id: string } }) {
    return this.operationsService.create(dto, req.user.id);
  }

  @Get()
  findAll(@Query() query: Record<string, string>) {
    const filter: OpFilterDto = OpFilterSchema.parse(query);
    return this.operationsService.findAll(filter);
  }

  @Get('kpis/par')
  kpisByPar(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.operationsService.kpisByPar(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('kpis/operador')
  kpisByOperador(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.operationsService.kpisByOperador(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.operationsService.findOne(id);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(UpdateOpSchema))
  update(@Param('id') id: string, @Body() dto: UpdateOpDto) {
    return this.operationsService.update(id, dto);
  }

  @Post(':id/finalize')
  finalize(@Param('id') id: string) {
    return this.operationsService.finalize(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.operationsService.cancel(id);
  }
}
