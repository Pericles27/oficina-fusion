import { Module } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ETicketsController } from './e-tickets.controller';
import { ETicketsService } from './e-tickets.service';

@Module({
  imports: [AuthModule],
  controllers: [ETicketsController],
  providers: [PrismaService, ETicketsService],
  exports: [ETicketsService],
})
export class ETicketsModule {}
