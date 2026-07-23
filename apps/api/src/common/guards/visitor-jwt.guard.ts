import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { TokenService } from '../token/token.service';

// نگهبان احراز هویت بازدیدکننده برای مسیرهای REST ویجت — توکن کوتاه‌عمر مقید به دامنه
@Injectable()
export class VisitorJwtGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('توکن بازدیدکننده ارسال نشده است');
    }

    try {
      const payload = this.tokenService.verifyVisitorToken(token);
      (request as Request & { visitor?: unknown }).visitor = payload;
      return true;
    } catch {
      throw new UnauthorizedException('توکن بازدیدکننده نامعتبر یا منقضی شده است');
    }
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return null;
    }
    return header.slice('Bearer '.length).trim();
  }
}
