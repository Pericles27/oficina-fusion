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
import { ETicketsService } from './e-tickets.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  CreateEticketSchema,
  UpdateEticketSchema,
  CreateEticketDto,
  UpdateEticketDto,
} from './dto/eticket.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('e-tickets')
export class ETicketsController {
  constructor(private eTicketsService: ETicketsService) {}

  // F2: crear/editar e-tickets requiere ADMIN u OPERADOR (antes sólo ADMIN
  // en create, y sin restricción en update — ver §2A del plan).
  @Post()
  @Roles(RolUsuario.ADMIN, RolUsuario.OPERADOR)
  @UsePipes(new ZodValidationPipe(CreateEticketSchema))
  create(@Body() dto: CreateEticketDto, @Req() req: Request & { user: { id: string } }) {
    return this.eTicketsService.create(dto, req.user.id);
  }

  // F5: el alcance de lo que ve un CADETE se deriva del TOKEN, nunca de un
  // query param — un cadeteId que viniera del cliente permitiría a
  // cualquier cadete ver los e-tickets de otro con sólo cambiar el query.
  // Alcance mínimo (sin migración, decisión documentada en
  // ANALISIS-FASES-3-4-5.md §2 opción C, pendiente de confirmar con
  // Nicolás): el cadete ve TODOS los pendientes (bolsa común), no sólo los
  // suyos — no existe campo `asignadoA` en el modelo Eticket todavía.
  @Get()
  findAll(
    @Req() req: Request & { user: { id: string; roles: RolUsuario[] } },
    @Query('estado') estado?: string,
    @Query('clienteId') clienteId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const esCadete =
      req.user.roles.includes(RolUsuario.CADETE) && !req.user.roles.includes(RolUsuario.ADMIN);

    return this.eTicketsService.findAll({
      estado,
      clienteId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      scopeCadete: esCadete,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request & { user: { roles: RolUsuario[] } }) {
    // El cadete nunca ve datos económicos del e-ticket
    if (req.user.roles.includes(RolUsuario.CADETE) && !req.user.roles.includes(RolUsuario.ADMIN)) {
      return this.eTicketsService.findOneForCadete(id);
    }
    return this.eTicketsService.findOne(id);
  }

  @Put(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.OPERADOR)
  @UsePipes(new ZodValidationPipe(UpdateEticketSchema))
  update(@Param('id') id: string, @Body() dto: UpdateEticketDto) {
    return this.eTicketsService.update(id, dto);
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string, @Req() req: Request & { user: { id: string } }) {
    return this.eTicketsService.confirm(id, req.user.id);
  }

  @Post(':id/cancel')
  @Roles(RolUsuario.ADMIN)
  cancel(@Param('id') id: string) {
    return this.eTicketsService.cancel(id);
  }
}
