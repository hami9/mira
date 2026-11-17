import { Module } from '@nestjs/common';
import { WordPressService } from './wordpress.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity, SiteEntity } from '../../database/entities';
import { WordPressController } from './wordpress.controller';
import { GuardsModule } from '../../common/guards/guards.module';

@Module({
  imports: [TypeOrmModule.forFeature([SiteEntity, AgentEntity]), GuardsModule],
  controllers: [WordPressController],
  providers: [WordPressService],
  exports: [WordPressService],
})
export class WordPressModule {}
