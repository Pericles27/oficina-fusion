import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsArray,
  IsIn,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { RolUsuario } from '@prisma/client';

// === DTOs ===
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsArray()
  @IsIn([RolUsuario.ADMIN, RolUsuario.OPERADOR, RolUsuario.CADETE], { each: true })
  roles?: ('ADMIN' | 'OPERADOR' | 'CADETE')[];
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}

// F2 D4: PATCH /users/:id — sólo ADMIN. Activar/desactivar y cambiar roles.
export class UpdateUserDto {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn([RolUsuario.ADMIN, RolUsuario.OPERADOR, RolUsuario.CADETE], { each: true })
  roles?: RolUsuario[];
}
