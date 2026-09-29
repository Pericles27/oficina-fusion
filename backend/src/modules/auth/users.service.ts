import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { Usuario, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

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

  /**
   * PATCH /users/:id — activo y/o roles. Sólo ADMIN (enforced en el
   * controller). No permite tocar username/nombre/email desde acá: eso
   * queda fuera del alcance de D4.
   */
  async updateUser(
    id: string,
    data: { activo?: boolean; roles?: RolUsuario[] },
  ): Promise<Omit<Usuario, 'passwordHash'> | null> {
    return this.prisma.usuario.update({
      where: { id },
      data: {
        ...(data.activo !== undefined ? { activo: data.activo } : {}),
        ...(data.roles !== undefined ? { roles: data.roles } : {}),
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

  /**
   * POST /users/:id/reset-password — sólo ADMIN. Genera una contraseña
   * temporal aleatoria, la hashea, y fuerza `primerLogin=true` para que el
   * usuario la cambie en su próximo ingreso. El admin nunca conoce la
   * contraseña final: sólo ve esta temporal una vez, en la respuesta.
   */
  async resetPassword(id: string): Promise<{ temporaryPassword: string }> {
    const temporaryPassword = crypto.randomBytes(9).toString('base64url'); // 12 chars
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await this.prisma.usuario.update({
      where: { id },
      data: {
        passwordHash,
        primerLogin: true,
        intentosFallidos: 0,
        bloqueado: false,
        bloqueadoHasta: null,
      },
    });

    return { temporaryPassword };
  }
}
