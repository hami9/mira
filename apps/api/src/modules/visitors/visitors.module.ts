import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity, VisitorEntity, VisitorPageViewEntity } from '../../database/entities';
import { GuardsModule } from '../../common/guards/guards.module';
import { TokenModule } from '../../common/token/token.module';
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module';
import { SitesModule } from '../sites/sites.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { WordPressModule } from '../wordpress/wordpress.module';
import { PermissionGuard } from '../../common/guards/require-permission.decorator';
import { VisitorsService } from './visitors.service';
import { VisitorsController } from './visitors.controller';
import { VisitorInfoController } from './visitor-info.controller';
import { VisitorsDirectoryService } from './visitors-directory.service';
import { VisitorsDirectoryController } from './visitors-directory.controller';

@Module({
  imports: [
    // AgentEntity برای PermissionGuard لازم است (دسترسی‌ها هر بار تازه از دیتابیس خوانده می‌شوند)
    TypeOrmModule.forFeature([VisitorEntity, VisitorPageViewEntity, AgentEntity]),
    GuardsModule,
    TokenModule,
    RateLimitModule,
    SitesModule,
    ConversationsModule,
    MessagesModule,
    WordPressModule,
  ],
  controllers: [VisitorsController, VisitorInfoController, VisitorsDirectoryController],
  providers: [VisitorsService, VisitorsDirectoryService, PermissionGuard],
  exports: [VisitorsService],
})
export class VisitorsModule {}
