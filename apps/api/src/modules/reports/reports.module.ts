import { Module } from '@nestjs/common';
import { GuardsModule } from '../../common/guards/guards.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [GuardsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
