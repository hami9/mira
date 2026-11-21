import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthSessionsResponseDto } from '@mira/shared-types';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SessionRequestDto } from './dto/session.dto';
import { TwoFactorLoginRequestDto, VerifyTwoFactorSetupRequestDto } from './dto/two-factor.dto';
import {
  isTrustedSessionRequest,
  readSessionCookies,
  SESSION_COOKIE_PATH,
  SESSION_MARKER_HEADER,
  sessionCookieName,
} from './session-cookie';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: SESSION_COOKIE_PATH,
    };
  }

  private rememberSession(response: Response, refreshToken?: string): void {
    if (!refreshToken) return;
    const { cookieName, maxAgeMs } = this.authService.describeRefreshToken(refreshToken);
    response.cookie(cookieName, refreshToken, { ...this.cookieOptions(), maxAge: maxAgeMs });
  }

  private assertTrustedSessionRequest(request: Request): void {
    const trusted = isTrustedSessionRequest({
      marker: request.get(SESSION_MARKER_HEADER),
      origin: request.get('origin'),
      host: request.get('host'),
    });
    if (!trusted) throw new ForbiddenException('درخواست نشست معتبر نیست');
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto.email, dto.password);
    this.rememberSession(response, result.refreshToken);
    return result;
  }

  // بازیابی و تمدید نشست با کوکی؛ توکن تمدید هرگز در پاسخ این مسیر برنمی‌گردد.
  @Post('session')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async session(
    @Body() dto: SessionRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionsResponseDto> {
    this.assertTrustedSessionRequest(request);
    const { sessions, staleCookies } = await this.authService.restoreSessions(
      readSessionCookies(request.headers.cookie),
      dto.agentId,
    );
    for (const name of staleCookies) response.clearCookie(name, this.cookieOptions());
    return { sessions };
  }

  @Post('logout')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  logout(
    @Body() dto: SessionRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): void {
    this.assertTrustedSessionRequest(request);
    const names = dto.agentId
      ? [sessionCookieName(dto.agentId)]
      : readSessionCookies(request.headers.cookie).map((cookie) => cookie.name);
    for (const name of names) response.clearCookie(name, this.cookieOptions());
  }

  // مرحله‌ی دوم لاگین وقتی 2FA فعاله — سقف سخت‌گیرانه برای جلوگیری از brute-force کد ۶ رقمی
  @Post('2fa/verify-login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyTwoFactorLogin(
    @Body() dto: TwoFactorLoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyTwoFactorLogin(dto.twoFactorToken, dto.code);
    this.rememberSession(response, result.refreshToken);
    return result;
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // هر اپراتور 2FA خودش رو مدیریت می‌کنه (نه ادمین برای دیگران) — پس فقط توکن خودش لازمه
  @Get('2fa/status')
  @UseGuards(AgentJwtGuard)
  getTwoFactorStatus(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.authService.getTwoFactorStatus(agent.sub);
  }

  @Post('2fa/setup')
  @HttpCode(200)
  @UseGuards(AgentJwtGuard)
  startTwoFactorSetup(@CurrentAgent() agent: AgentAccessTokenPayload) {
    return this.authService.startTwoFactorSetup(agent.sub);
  }

  @Post('2fa/confirm')
  @HttpCode(200)
  @UseGuards(AgentJwtGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  confirmTwoFactorSetup(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Body() dto: VerifyTwoFactorSetupRequestDto,
  ) {
    return this.authService.confirmTwoFactorSetup(agent.sub, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(200)
  @UseGuards(AgentJwtGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  disableTwoFactor(
    @CurrentAgent() agent: AgentAccessTokenPayload,
    @Body() dto: VerifyTwoFactorSetupRequestDto,
  ) {
    return this.authService.disableTwoFactor(agent.sub, dto.code);
  }
}
