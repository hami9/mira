import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import {
  LoginResponseDto,
  RefreshResponseDto,
  TwoFactorSetupResponseDto,
  TwoFactorStatusDto,
} from '@mira/shared-types';
import { AgentEntity } from '../../database/entities';
import { TokenService } from '../../common/token/token.service';

const TOTP_ISSUER = 'Mira';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentsRepository: Repository<AgentEntity>,
    private readonly tokenService: TokenService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const agent = await this.agentsRepository.findOne({ where: { email } });
    if (!agent) {
      throw new UnauthorizedException('ایمیل یا رمز عبور نادرست است');
    }

    const passwordMatches = await bcrypt.compare(password, agent.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('ایمیل یا رمز عبور نادرست است');
    }

    // اگه 2FA فعاله، هنوز توکن واقعی صادر نمی‌کنیم — فقط یک توکن کوتاه‌عمر برای مرحله‌ی دوم
    if (agent.twoFactorEnabled) {
      return {
        twoFactorRequired: true,
        twoFactorToken: this.tokenService.signAgentTwoFactorPendingToken({ sub: agent.id }),
      };
    }

    return this.issueTokens(agent);
  }

  async verifyTwoFactorLogin(twoFactorToken: string, code: string): Promise<LoginResponseDto> {
    let payload;
    try {
      payload = this.tokenService.verifyAgentTwoFactorPendingToken(twoFactorToken);
    } catch {
      throw new UnauthorizedException('مهلت تأیید دومرحله‌ای تمام شده است، دوباره وارد شوید');
    }
    if (payload.type !== 'agent_2fa_pending') {
      throw new UnauthorizedException('توکن نامعتبر است');
    }

    const agent = await this.agentsRepository.findOne({ where: { id: payload.sub } });
    if (!agent || !agent.twoFactorEnabled || !agent.twoFactorSecret) {
      throw new UnauthorizedException('احراز هویت دومرحله‌ای برای این اپراتور فعال نیست');
    }

    if (!authenticator.check(code, agent.twoFactorSecret)) {
      throw new UnauthorizedException('کد تأیید نادرست است');
    }

    return this.issueTokens(agent);
  }

  async getTwoFactorStatus(agentId: string): Promise<TwoFactorStatusDto> {
    const agent = await this.findAgentOrFail(agentId);
    return { enabled: agent.twoFactorEnabled };
  }

  // سکرت ذخیره می‌شه ولی تا وقتی اولین کد با موفقیت تأیید نشه، twoFactorEnabled=false می‌مونه —
  // یعنی یک راه‌اندازی نیمه‌کاره هیچ‌وقت اپراتور رو از حسابش قفل نمی‌کنه
  async startTwoFactorSetup(agentId: string): Promise<TwoFactorSetupResponseDto> {
    const agent = await this.findAgentOrFail(agentId);
    const secret = authenticator.generateSecret();
    agent.twoFactorSecret = secret;
    agent.twoFactorEnabled = false;
    await this.agentsRepository.save(agent);

    const otpauthUrl = authenticator.keyuri(agent.email, TOTP_ISSUER, secret);
    const qrCodeDataUrl = await toDataURL(otpauthUrl);
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async confirmTwoFactorSetup(agentId: string, code: string): Promise<TwoFactorStatusDto> {
    const agent = await this.findAgentOrFail(agentId);
    if (!agent.twoFactorSecret) {
      throw new BadRequestException('ابتدا مرحله‌ی راه‌اندازی را شروع کنید');
    }
    if (!authenticator.check(code, agent.twoFactorSecret)) {
      throw new BadRequestException('کد تأیید نادرست است');
    }
    agent.twoFactorEnabled = true;
    await this.agentsRepository.save(agent);
    return { enabled: true };
  }

  // غیرفعال‌کردن هم به کد فعلی نیاز داره تا کسی که به یک نشست باز دسترسی پیدا کرده نتونه ۲FA رو خاموش کنه
  async disableTwoFactor(agentId: string, code: string): Promise<TwoFactorStatusDto> {
    const agent = await this.findAgentOrFail(agentId);
    if (!agent.twoFactorEnabled || !agent.twoFactorSecret) {
      return { enabled: false };
    }
    if (!authenticator.check(code, agent.twoFactorSecret)) {
      throw new BadRequestException('کد تأیید نادرست است');
    }
    agent.twoFactorEnabled = false;
    agent.twoFactorSecret = null;
    await this.agentsRepository.save(agent);
    return { enabled: false };
  }

  async refresh(refreshToken: string): Promise<RefreshResponseDto> {
    let payload;
    try {
      payload = this.tokenService.verifyAgentRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('refresh token نامعتبر یا منقضی شده است');
    }

    const agent = await this.agentsRepository.findOne({ where: { id: payload.sub } });
    if (!agent) {
      throw new UnauthorizedException('اپراتور پیدا نشد');
    }

    const accessToken = this.tokenService.signAgentAccessToken({
      sub: agent.id,
      siteId: agent.siteId,
      role: agent.role,
    });
    return { accessToken };
  }

  private async findAgentOrFail(agentId: string): Promise<AgentEntity> {
    const agent = await this.agentsRepository.findOne({ where: { id: agentId } });
    if (!agent) {
      throw new UnauthorizedException('اپراتور پیدا نشد');
    }
    return agent;
  }

  private issueTokens(agent: AgentEntity): LoginResponseDto {
    const accessToken = this.tokenService.signAgentAccessToken({
      sub: agent.id,
      siteId: agent.siteId,
      role: agent.role,
    });
    const refreshToken = this.tokenService.signAgentRefreshToken({ sub: agent.id });
    return { accessToken, refreshToken };
  }
}
