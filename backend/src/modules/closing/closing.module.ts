import { Module } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ClosingController } from './closing.controller';
import { ClosingService } from './closing.service';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';

@Module({
  imports: [AuthModule],
  controllers: [ClosingController, MovimientosController],
  providers: [PrismaService, ClosingService, MovimientosService],
  exports: [ClosingService],
})
export class ClosingModule {}
