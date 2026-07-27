import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { TwoFactorLoginRequestDto, VerifyTwoFactorSetupRequestDto } from './dto/two-factor.dto';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // مرحله‌ی دوم لاگین وقتی 2FA فعاله — سقف سخت‌گیرانه برای جلوگیری از brute-force کد ۶ رقمی
  @Post('2fa/verify-login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyTwoFactorLogin(@Body() dto: TwoFactorLoginRequestDto) {
    return this.authService.verifyTwoFactorLogin(dto.twoFactorToken, dto.code);
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
