import { Injectable, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@common/prisma/prisma.service';
import { LoginDto, RegisterDto, ChangePasswordDto } from './dtos';
import { Usuario, RolUsuario, LoginEvent as LoginEventModel } from '@prisma/client';

interface JwtPayload {
  id: string;
  username: string;
  roles: RolUsuario[];
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ access_token: string; user: Omit<Usuario, 'passwordHash'> }> {
    const user = await this.prisma.usuario.findUnique({
      where: { username: dto.username },
    });

    if (!user) {
      await this.logLoginEvent(null, false, dto.username, 'User not found');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.bloqueado && user.bloqueadoHasta && user.bloqueadoHasta > new Date()) {
      await this.logLoginEvent(user.id, false, dto.username, 'Account temporarily blocked');
      throw new ForbiddenException(`Account blocked until ${user.bloqueadoHasta.toISOString()}`);
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!valid) {
      const newAttempts = user.intentosFallidos + 1;
      let bloqueadoHasta: Date | undefined;

      if (newAttempts >= 5) {
        bloqueadoHasta = new Date(Date.now() + 30 * 60 * 1000); // 30 min
      }

      await this.prisma.usuario.update({
        where: { id: user.id },
        data: {
          intentosFallidos: newAttempts,
          bloqueado: bloqueadoHasta ? true : false,
          bloqueadoHasta,
        },
      });

      await this.logLoginEvent(user.id, false, dto.username, 'Invalid password');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on success
    await this.prisma.usuario.update({
      where: { id: user.id },
      data: { intentosFallidos: 0 },
    });

    await this.logLoginEvent(user.id, true, dto.username);

    const token = this.generateToken(user);
    const { passwordHash, ...safeUser } = user;

    return { access_token: token, user: safeUser };
  }

  async register(dto: RegisterDto): Promise<{ access_token: string; user: Omit<Usuario, 'passwordHash'> }> {
    // Check username uniqueness
    const existing = await this.prisma.usuario.findUnique({
      where: { username: dto.username },
    });

    if (existing) {
      throw new ConflictException('Username already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.usuario.create({
      data: {
        username: dto.username,
        passwordHash,
        nombre: dto.nombre,
        email: dto.email,
        roles: dto.roles || [RolUsuario.CADETE],
      },
    });

    const { passwordHash: _ph, ...safeUser } = user;
    const token = this.generateToken(user);

    return { access_token: token, user: safeUser };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        primerLogin: false,
      },
    });
  }

  async refreshToken(userId: string): Promise<{ access_token: string }> {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!user || !user.activo) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return { access_token: this.generateToken(user) };
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.sesion.deleteMany({
      where: { usuarioId: userId },
    });
  }

  async getUserById(id: string): Promise<Omit<Usuario, 'passwordHash'> | null> {
    const user = await this.prisma.usuario.findUnique({
      where: { id },
    });

    if (!user) return null;
    const { passwordHash, ...safe } = user;
    return safe;
  }

  private generateToken(user: Usuario): string {
    const payload: JwtPayload = {
      id: user.id,
      username: user.username,
      roles: user.roles,
    };

    return this.jwtService.sign(payload);
  }

  private async logLoginEvent(
    usuarioId: string | null,
    exitoso: boolean,
    username: string,
    motivoFallo?: string,
  ): Promise<void> {
    const headers = { username }; // just for context, ip not available here
    await this.prisma.loginEvent.create({
      data: {
        usuarioId: usuarioId || undefined,
        exitoso,
        motivoFallo: motivoFallo || undefined,
      },
    });
  }
}
