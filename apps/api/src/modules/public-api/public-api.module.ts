import { Module } from '@nestjs/common';
import { SitesModule } from '../sites/sites.module';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { PublicApiService } from './public-api.service';
import { PublicApiController } from './public-api.controller';

@Module({
  imports: [SitesModule],
  controllers: [PublicApiController],
  providers: [PublicApiService, ApiKeyGuard],
})
export class PublicApiModule {}
