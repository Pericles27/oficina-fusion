import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Usuario, RolUsuario } from '@prisma/client';
import { getJwtSecret } from '@common/config/jwt-secret';

interface JwtPayload {
  id: string;
  username: string;
  roles: RolUsuario[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<Partial<Usuario>> {
    return {
      id: payload.id,
      username: payload.username,
      roles: payload.roles,
    };
  }
}
