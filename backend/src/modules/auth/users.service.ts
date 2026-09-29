import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { Usuario, RolUsuario } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Omit<Usuario, 'passwordHash'>[]> {
    return this.prisma.usuario.findMany({
      select: {
        id: true,
        username: true,
        nombre: true,
        roles: true,
        email: true,
        activo: true,
        bloqueado: true,
        bloqueadoHasta: true,
        intentosFallidos: true,
        primerLogin: true,
        creadoEn: true,
        modificadoEn: true,
      },
    });
  }

  async findById(id: string): Promise<Omit<Usuario, 'passwordHash'> | null> {
    const user = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        nombre: true,
        roles: true,
        email: true,
        activo: true,
        bloqueado: true,
        bloqueadoHasta: true,
        primerLogin: true,
        intentosFallidos: true,
        creadoEn: true,
        modificadoEn: true,
      },
    });
    return user as Omit<Usuario, 'passwordHash'> | null;
  }

  async findByUsername(username: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({
      where: { username },
    });
  }

  async activate(id: string): Promise<Omit<Usuario, 'passwordHash'> | null> {
    return this.prisma.usuario.update({
      where: { id },
      data: { activo: true },
      select: {
        id: true,
        username: true,
        nombre: true,
        roles: true,
        email: true,
        activo: true,
        bloqueado: true,
        bloqueadoHasta: true,
        intentosFallidos: true,
        primerLogin: true,
        creadoEn: true,
        modificadoEn: true,
      },
    }) as Promise<Omit<Usuario, 'passwordHash'> | null>;
  }

  async block(id: string, bloqueadoHasta?: Date): Promise<Omit<Usuario, 'passwordHash'> | null> {
    return this.prisma.usuario.update({
      where: { id },
      data: {
        bloqueado: true,
        bloqueadoHasta,
      },
      select: {
        id: true,
        username: true,
        nombre: true,
        roles: true,
        email: true,
        activo: true,
        bloqueado: true,
        bloqueadoHasta: true,
        intentosFallidos: true,
        primerLogin: true,
        creadoEn: true,
        modificadoEn: true,
      },
    }) as Promise<Omit<Usuario, 'passwordHash'> | null>;
  }

  async updateRole(
    id: string,
    roles: RolUsuario[],
  ): Promise<Omit<Usuario, 'passwordHash'> | null> {
    return this.prisma.usuario.update({
      where: { id },
      data: { roles },
      select: {
        id: true,
        username: true,
        nombre: true,
        roles: true,
        email: true,
        activo: true,
        bloqueado: true,
        bloqueadoHasta: true,
        intentosFallidos: true,
        primerLogin: true,
        creadoEn: true,
        modificadoEn: true,
      },
    }) as Promise<Omit<Usuario, 'passwordHash'> | null>;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.usuario.delete({
      where: { id },
    });
  }
}
