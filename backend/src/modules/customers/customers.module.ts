import { Module } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [AuthModule],
  controllers: [CustomersController],
  providers: [PrismaService, CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
