import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { ClosingService } from './closing.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { CreateCierreSchema, CreateCierreDto } from './dto/closing.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
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
  confirm(@Param('id') id: string) {
    return this.closingService.confirm(id);
  }

  @Post(':id/reopen')
  reopen(@Param('id') id: string) {
    return this.closingService.reopen(id);
  }
}
