import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { TokenService } from '../token/token.service';

// نگهبان احراز هویت اپراتور برای مسیرهای REST — توکن access کوتاه‌عمر را از هدر Authorization می‌خواند
@Injectable()
export class AgentJwtGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('توکن اپراتور ارسال نشده است');
    }

    try {
      const payload = this.tokenService.verifyAgentAccessToken(token);
      (request as Request & { agent?: unknown }).agent = payload;
      return true;
    } catch {
      throw new UnauthorizedException('توکن اپراتور نامعتبر یا منقضی شده است');
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
