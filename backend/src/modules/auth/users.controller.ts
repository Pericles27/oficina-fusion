import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { UpdateUserDto } from './dtos';

// F2 D4: gestión de usuarios — todo el módulo es ADMIN-only. Activar/
// desactivar cuentas y resetear contraseñas son operaciones privilegiadas.
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
  @Roles(RolUsuario.ADMIN)
  async findById(@Query('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @Post(':id/reset-password')
  @Roles(RolUsuario.ADMIN)
  async resetPassword(@Param('id') id: string) {
    return this.usersService.resetPassword(id);
  }
}
