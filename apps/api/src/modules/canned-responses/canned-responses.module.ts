import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CannedResponseEntity } from '../../database/entities';
import { GuardsModule } from '../../common/guards/guards.module';
import { CannedResponsesService } from './canned-responses.service';
import { CannedResponsesController } from './canned-responses.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CannedResponseEntity]), GuardsModule],
  controllers: [CannedResponsesController],
  providers: [CannedResponsesService],
})
export class CannedResponsesModule {}
