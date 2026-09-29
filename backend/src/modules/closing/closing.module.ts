import { Module } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ClosingController } from './closing.controller';
import { ClosingService } from './closing.service';

@Module({
  imports: [AuthModule],
  controllers: [ClosingController],
  providers: [PrismaService, ClosingService],
  exports: [ClosingService],
})
export class ClosingModule {}
