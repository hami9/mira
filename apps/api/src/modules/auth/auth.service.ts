import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { LoginResponseDto, RefreshResponseDto } from '@mira/shared-types';
import { AgentEntity } from '../../database/entities';
import { TokenService } from '../../common/token/token.service';

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

    return this.issueTokens(agent);
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
