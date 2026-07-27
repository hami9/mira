import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { SitesService } from '../../modules/sites/sites.service';

// نگهبان API عمومی (فاز ۶) — با کلید سایت (نه توکن اپراتور/بازدیدکننده) احراز هویت می‌شه
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly sitesService: SitesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];
    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('کلید API ارسال نشده است');
    }

    const site = await this.sitesService.findByApiKey(apiKey);
    if (!site) {
      throw new UnauthorizedException('کلید API نامعتبر است');
    }

    (request as Request & { publicApiSiteId?: string }).publicApiSiteId = site.id;
    return true;
  }
}
