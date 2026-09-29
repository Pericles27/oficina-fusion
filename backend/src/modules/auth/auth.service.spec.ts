import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, ForbiddenException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { RolUsuario } from '@prisma/client';

function makePrismaMock() {
  return {
    usuario: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    sesion: {
      deleteMany: vi.fn(),
    },
    loginEvent: {
      create: vi.fn(),
    },
  };
}

function makeJwtMock() {
  return {
    sign: vi.fn(() => 'signed.jwt.token'),
  };
}

const baseUser = {
  id: 'user-1',
  username: 'jdoe',
  passwordHash: '',
  nombre: 'John Doe',
  email: null,
  roles: [RolUsuario.ADMIN],
  activo: true,
  bloqueado: false,
  bloqueadoHasta: null,
  intentosFallidos: 0,
  primerLogin: true,
  creadoEn: new Date(),
  modificadoEn: new Date(),
};

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let jwt: ReturnType<typeof makeJwtMock>;
  let service: AuthService;

  beforeEach(async () => {
    prisma = makePrismaMock();
    jwt = makeJwtMock();
    service = new AuthService(prisma as any, jwt as any);
  });

  describe('login', () => {
    it('lanza UnauthorizedException si el usuario no existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      await expect(service.login({ username: 'ghost', password: 'x' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.loginEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ exitoso: false }) }),
      );
    });

    it('lanza ForbiddenException si el usuario está bloqueado y el bloqueo no expiró', async () => {
      const future = new Date(Date.now() + 60_000);
      prisma.usuario.findUnique.mockResolvedValue({
        ...baseUser,
        bloqueado: true,
        bloqueadoHasta: future,
      });

      await expect(service.login({ username: 'jdoe', password: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lanza UnauthorizedException con password incorrecta e incrementa intentosFallidos', async () => {
      const hash = await bcrypt.hash('correct-password', 10);
      prisma.usuario.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash, intentosFallidos: 2 });

      await expect(
        service.login({ username: 'jdoe', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ intentosFallidos: 3 }),
        }),
      );
    });

    it('bloquea la cuenta al alcanzar 5 intentos fallidos', async () => {
      const hash = await bcrypt.hash('correct-password', 10);
      prisma.usuario.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash, intentosFallidos: 4 });

      await expect(
        service.login({ username: 'jdoe', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);

      const updateCall = prisma.usuario.update.mock.calls[0][0];
      expect(updateCall.data.bloqueado).toBe(true);
      expect(updateCall.data.bloqueadoHasta).toBeInstanceOf(Date);
    });

    it('genera token JWT y resetea intentosFallidos con credenciales válidas', async () => {
      const hash = await bcrypt.hash('correct-password', 10);
      prisma.usuario.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash, intentosFallidos: 3 });
      prisma.usuario.update.mockResolvedValue(baseUser);

      const result = await service.login({ username: 'jdoe', password: 'correct-password' });

      expect(result.access_token).toBe('signed.jwt.token');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1', username: 'jdoe', roles: [RolUsuario.ADMIN] }),
      );
      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { intentosFallidos: 0 } }),
      );
    });
  });

  describe('register', () => {
    it('lanza ConflictException si el username ya existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue(baseUser);

      await expect(
        service.register({ username: 'jdoe', password: 'x', nombre: 'John' }),
      ).rejects.toThrow(ConflictException);
    });

    it('crea el usuario con rol CADETE por default y retorna token', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockResolvedValue({ ...baseUser, roles: [RolUsuario.CADETE] });

      const result = await service.register({ username: 'newuser', password: 'x', nombre: 'New' });

      expect(prisma.usuario.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ roles: [RolUsuario.CADETE] }),
        }),
      );
      expect(result.access_token).toBe('signed.jwt.token');
    });
  });

  describe('changePassword', () => {
    it('lanza UnauthorizedException si el usuario no existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(
        service.changePassword('missing', { currentPassword: 'a', newPassword: 'b' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si la password actual es incorrecta', async () => {
      const hash = await bcrypt.hash('real-password', 10);
      prisma.usuario.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash });

      await expect(
        service.changePassword('user-1', { currentPassword: 'wrong', newPassword: 'new' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('actualiza el hash y marca primerLogin en false cuando la password actual es correcta', async () => {
      const hash = await bcrypt.hash('real-password', 10);
      prisma.usuario.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash });

      await service.changePassword('user-1', { currentPassword: 'real-password', newPassword: 'new-password' });

      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ primerLogin: false }),
        }),
      );
    });
  });

  describe('refreshToken', () => {
    it('lanza UnauthorizedException si el usuario no existe o está inactivo', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(service.refreshToken('missing')).rejects.toThrow(UnauthorizedException);

      prisma.usuario.findUnique.mockResolvedValue({ ...baseUser, activo: false });
      await expect(service.refreshToken('user-1')).rejects.toThrow(UnauthorizedException);
    });

    it('retorna un nuevo access_token para usuario activo', async () => {
      prisma.usuario.findUnique.mockResolvedValue(baseUser);
      const result = await service.refreshToken('user-1');
      expect(result.access_token).toBe('signed.jwt.token');
    });
  });

  describe('logout', () => {
    it('elimina las sesiones del usuario', async () => {
      await service.logout('user-1');
      expect(prisma.sesion.deleteMany).toHaveBeenCalledWith({ where: { usuarioId: 'user-1' } });
    });
  });
});
