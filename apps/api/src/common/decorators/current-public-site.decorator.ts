import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

// ApiKeyGuard هنگام تأیید کلید API، siteId متناظر رو روی request می‌ذاره
export const CurrentPublicSite = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request & { publicApiSiteId: string }>();
    return request.publicApiSiteId;
  },
);
