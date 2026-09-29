import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { RolUsuario } from '@prisma/client';

function makeContext(userId?: string): ExecutionContext {
  const request: any = { user: userId ? { id: userId } : undefined };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let prisma: { usuario: { findUnique: ReturnType<typeof vi.fn> } };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    prisma = { usuario: { findUnique: vi.fn() } };
    guard = new RolesGuard(reflector as unknown as Reflector, prisma as any);
  });

  it('permite el acceso cuando el handler no requiere roles', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = makeContext('u1');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('lanza ForbiddenException si no hay usuario autenticado', async () => {
    reflector.getAllAndOverride.mockReturnValue([RolUsuario.ADMIN]);
    const ctx = makeContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('lanza ForbiddenException si el usuario no tiene roles asignados', async () => {
    reflector.getAllAndOverride.mockReturnValue([RolUsuario.ADMIN]);
    prisma.usuario.findUnique.mockResolvedValue({ roles: [] });
    const ctx = makeContext('u1');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('lanza ForbiddenException si el rol del usuario no está en los roles requeridos', async () => {
    reflector.getAllAndOverride.mockReturnValue([RolUsuario.ADMIN]);
    prisma.usuario.findUnique.mockResolvedValue({ roles: [RolUsuario.CADETE] });
    const ctx = makeContext('u1');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('permite el acceso cuando el usuario tiene uno de los roles requeridos', async () => {
    reflector.getAllAndOverride.mockReturnValue([RolUsuario.ADMIN, RolUsuario.CADETE]);
    prisma.usuario.findUnique.mockResolvedValue({ roles: [RolUsuario.CADETE] });
    const ctx = makeContext('u1');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // Regresión: Reflector.get() sólo lee metadata del handler (método), no de
  // la clase. Un @Roles() puesto a nivel de controller (como en
  // OperationsController/ClosingController tras F2) quedaba sin efecto y
  // dejaba el endpoint abierto a cualquier rol autenticado. El guard debe
  // usar getAllAndOverride([handler, class]) para heredar el @Roles de clase
  // cuando el método no define uno propio.
  it('usa getAllAndOverride para heredar @Roles de la clase cuando el método no define uno', async () => {
    reflector.getAllAndOverride.mockReturnValue([RolUsuario.ADMIN, RolUsuario.OPERADOR]);
    prisma.usuario.findUnique.mockResolvedValue({ roles: [RolUsuario.OPERADOR] });
    const ctx = makeContext('u1');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith('roles', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
  });
});
