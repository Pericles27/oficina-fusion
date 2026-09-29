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

  @Post()
  @Roles(RolUsuario.ADMIN)
  @UsePipes(new ZodValidationPipe(CreateEticketSchema))
  create(@Body() dto: CreateEticketDto, @Req() req: Request & { user: { id: string } }) {
    return this.eTicketsService.create(dto, req.user.id);
  }

  @Get()
  findAll(
    @Query('estado') estado?: string,
    @Query('clienteId') clienteId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.eTicketsService.findAll({
      estado,
      clienteId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
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
