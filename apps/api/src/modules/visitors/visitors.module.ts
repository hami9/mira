import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitorEntity, VisitorPageViewEntity } from '../../database/entities';
import { GuardsModule } from '../../common/guards/guards.module';
import { TokenModule } from '../../common/token/token.module';
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module';
import { SitesModule } from '../sites/sites.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { WordPressModule } from '../wordpress/wordpress.module';
import { VisitorsService } from './visitors.service';
import { VisitorsController } from './visitors.controller';
import { VisitorInfoController } from './visitor-info.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([VisitorEntity, VisitorPageViewEntity]),
    GuardsModule,
    TokenModule,
    RateLimitModule,
    SitesModule,
    ConversationsModule,
    MessagesModule,
    WordPressModule,
  ],
  controllers: [VisitorsController, VisitorInfoController],
  providers: [VisitorsService],
  exports: [VisitorsService],
})
export class VisitorsModule {}
