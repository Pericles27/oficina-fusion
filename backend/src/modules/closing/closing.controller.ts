import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { ClosingService } from './closing.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { CreateCierreSchema, CreateCierreDto } from './dto/closing.dto';

// F2 / default 3 (§6 del plan): el operador arma el borrador del cierre,
// el admin es el único que lo confirma o reabre. Separación de funciones:
// el que cuenta la caja no es el que la aprueba.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN, RolUsuario.OPERADOR)
@Controller('closing')
export class ClosingController {
  constructor(private closingService: ClosingService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateCierreSchema))
  create(@Body() dto: CreateCierreDto, @Req() req: Request & { user: { id: string } }) {
    return this.closingService.create(dto, req.user.id);
  }

  @Get()
  findAll(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.closingService.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.closingService.findOne(id);
  }

  @Post(':id/confirm')
  @Roles(RolUsuario.ADMIN)
  confirm(@Param('id') id: string) {
    return this.closingService.confirm(id);
  }

  @Post(':id/reopen')
  @Roles(RolUsuario.ADMIN)
  reopen(@Param('id') id: string) {
    return this.closingService.reopen(id);
  }
}
