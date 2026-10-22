import { Module } from '@nestjs/common';
import { GuardsModule } from '../../common/guards/guards.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { UsageService } from './usage.service';

@Module({
  imports: [GuardsModule],
  controllers: [BillingController],
  providers: [BillingService, UsageService],
})
export class BillingModule {}
