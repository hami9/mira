import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AgentRole } from '@mira/shared-types';

export interface AgentAccessTokenPayload {
  sub: string; // agentId
  siteId: string;
  role: AgentRole;
  type: 'agent_access';
}

export interface AgentRefreshTokenPayload {
  sub: string; // agentId
  type: 'agent_refresh';
}

// توکن کوتاه‌عمر مرحله‌ی میانی لاگین وقتی 2FA فعاله — رمز عبور تأیید شده ولی accessToken واقعی
// هنوز صادر نشده تا کد TOTP هم تأیید بشه
export interface AgentTwoFactorPendingTokenPayload {
  sub: string; // agentId
  type: 'agent_2fa_pending';
}

export interface VisitorTokenPayload {
  sub: string; // visitorId
  siteId: string;
  // دامنه‌ای که این توکن برای اون صادر شده؛ Gateway هنگام اتصال با Origin واقعی مقایسه‌اش می‌کنه
  domain: string;
  type: 'visitor';
}

// همه‌ی امضا/تایید توکن‌های پروژه (اپراتور و بازدیدکننده) از یک‌جا عبور می‌کنن
// تا سکرت/انقضای هرکدوم فقط در یک نقطه تعریف بشه
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAgentAccessToken(payload: Omit<AgentAccessTokenPayload, 'type'>): string {
    return this.jwtService.sign(
      { ...payload, type: 'agent_access' },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      },
    );
  }

  verifyAgentAccessToken(token: string): AgentAccessTokenPayload {
    return this.jwtService.verify<AgentAccessTokenPayload>(token, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  signAgentRefreshToken(payload: Omit<AgentRefreshTokenPayload, 'type'>): string {
    return this.jwtService.sign(
      { ...payload, type: 'agent_refresh' },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );
  }

  verifyAgentRefreshToken(token: string): AgentRefreshTokenPayload {
    return this.jwtService.verify<AgentRefreshTokenPayload>(token, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
    });
  }

  signAgentTwoFactorPendingToken(payload: Omit<AgentTwoFactorPendingTokenPayload, 'type'>): string {
    return this.jwtService.sign(
      { ...payload, type: 'agent_2fa_pending' },
      { secret: this.config.get<string>('JWT_ACCESS_SECRET'), expiresIn: '5m' },
    );
  }

  verifyAgentTwoFactorPendingToken(token: string): AgentTwoFactorPendingTokenPayload {
    return this.jwtService.verify<AgentTwoFactorPendingTokenPayload>(token, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  signVisitorToken(payload: Omit<VisitorTokenPayload, 'type'>): string {
    return this.jwtService.sign(
      { ...payload, type: 'visitor' },
      {
        secret: this.config.get<string>('WIDGET_TOKEN_SECRET'),
        expiresIn: this.config.get<string>('WIDGET_TOKEN_EXPIRES_IN', '1h'),
      },
    );
  }

  verifyVisitorToken(token: string): VisitorTokenPayload {
    return this.jwtService.verify<VisitorTokenPayload>(token, {
      secret: this.config.get<string>('WIDGET_TOKEN_SECRET'),
    });
  }
}
