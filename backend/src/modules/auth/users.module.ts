import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '@common/prisma/prisma.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { getJwtSecret } from '@common/config/jwt-secret';

@Module({
  imports: [
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '7d' },
    } as any),
  ],
  controllers: [UsersController],
  providers: [PrismaService, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
