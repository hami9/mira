import { Module } from '@nestjs/common';
import { GuardsModule } from '../../common/guards/guards.module';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

@Module({ imports: [GuardsModule], controllers: [SystemController], providers: [SystemService] })
export class SystemModule {}
