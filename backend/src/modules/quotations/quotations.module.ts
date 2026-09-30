import { Module } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';

@Module({
  imports: [AuthModule],
  controllers: [QuotationsController],
  providers: [PrismaService, QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
