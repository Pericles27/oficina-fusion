import { Module } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [AuthModule],
  controllers: [OperationsController],
  providers: [PrismaService, OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
