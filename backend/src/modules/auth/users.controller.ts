import { Controller, Get, Query, UseGuards, UseFilters } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';

@UseGuards(JwtAuthGuard, RolesGuard)
@UseFilters(GlobalExceptionFilter)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(RolUsuario.ADMIN)
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findById(@Query('id') id: string) {
    return this.usersService.findById(id);
  }
}
