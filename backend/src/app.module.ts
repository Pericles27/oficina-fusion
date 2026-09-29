import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { OperationsModule } from './modules/operations/operations.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ETicketsModule } from './modules/e-tickets/e-tickets.module';
import { ClosingModule } from './modules/closing/closing.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { TramitesModule } from './modules/tramites/tramites.module';
import { AgendaModule } from './modules/agenda/agenda.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    AuthModule,
    OperationsModule,
    CustomersModule,
    ETicketsModule,
    ClosingModule,
    QuotationsModule,
    TramitesModule,
    AgendaModule,
    ExpensesModule,
  ],
})
export class AppModule {}
