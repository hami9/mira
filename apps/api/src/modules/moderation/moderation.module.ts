import { Global, Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
@Global()
@Module({ providers: [ModerationService], exports: [ModerationService] })
export class ModerationModule {}
