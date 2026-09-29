import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { RolUsuario } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<RolUsuario[]>('roles', context.getHandler());
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Not authenticated');
    }

    const userRoles = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { roles: true },
    });

    if (!userRoles || userRoles.roles.length === 0) {
      throw new ForbiddenException('User has no roles');
    }

    const hasRole = userRoles.roles.some((r: RolUsuario) =>
      requiredRoles.includes(r),
    );

    if (!hasRole) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
