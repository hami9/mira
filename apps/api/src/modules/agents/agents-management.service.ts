import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  AgentDto,
  AgentProfileDto,
  AgentRole,
  ChangePasswordDto,
  CreateAgentDto,
  UpdateAgentDto,
  UpdateMyProfileDto,
} from '@mira/shared-types';
import { AgentEntity } from '../../database/entities';

const MIN_PASSWORD_LENGTH = 8;

@Injectable()
export class AgentsManagementService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentsRepository: Repository<AgentEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async listForSite(siteId: string): Promise<AgentDto[]> {
    const agents = await this.agentsRepository.find({
      where: { siteId },
      order: { createdAt: 'ASC' },
    });
    return agents.map(toDto);
  }

  async create(siteId: string, dto: CreateAgentDto): Promise<AgentDto> {
    const email = dto.email.trim().toLowerCase();
    // ایمیل در کل سیستم یکتاست (نه فقط در یک سایت) چون کلید ورود است
    const existing = await this.agentsRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('اپراتوری با این ایمیل از قبل وجود دارد');
    }
    if (dto.password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد`);
    }

    const agent = this.agentsRepository.create({
      siteId,
      email,
      fullName: dto.fullName.trim(),
      passwordHash: await bcrypt.hash(dto.password, 10),
      role: dto.role === 'admin' ? AgentRole.ADMIN : AgentRole.AGENT,
      phone: dto.phone?.trim() || null,
      permissions: dto.permissions ?? {},
    });
    return toDto(await this.agentsRepository.save(agent));
  }

  async update(
    siteId: string,
    agentId: string,
    actingAgentId: string,
    dto: UpdateAgentDto,
  ): Promise<AgentDto> {
    const agent = await this.findInSite(siteId, agentId);

    // ادمین نباید بتواند نقش ادمینِ خودش را بردارد و سایت را بدون ادمین بگذارد
    if (dto.role && dto.role !== agent.role) {
      if (agent.id === actingAgentId && dto.role !== 'admin') {
        throw new BadRequestException('نمی‌توانید نقش ادمین خودتان را تغییر دهید');
      }
      if (agent.role === AgentRole.ADMIN && dto.role === 'agent') {
        await this.assertNotLastAdmin(siteId, agent.id);
      }
      agent.role = dto.role === 'admin' ? AgentRole.ADMIN : AgentRole.AGENT;
    }

    if (dto.fullName !== undefined) agent.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) agent.phone = dto.phone?.trim() || null;
    if (dto.bio !== undefined) agent.bio = dto.bio?.trim() || null;
    if (dto.avatarUrl !== undefined) agent.avatarUrl = dto.avatarUrl?.trim() || null;
    if (dto.permissions !== undefined) agent.permissions = dto.permissions;
    if (dto.password) {
      if (dto.password.length < MIN_PASSWORD_LENGTH) {
        throw new BadRequestException(`رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد`);
      }
      agent.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return toDto(await this.agentsRepository.save(agent));
  }

  async delete(siteId: string, agentId: string, actingAgentId: string): Promise<void> {
    if (agentId === actingAgentId) {
      throw new BadRequestException('نمی‌توانید حساب خودتان را حذف کنید');
    }
    const agent = await this.findInSite(siteId, agentId);
    if (agent.role === AgentRole.ADMIN) {
      await this.assertNotLastAdmin(siteId, agent.id);
    }
    await this.agentsRepository.delete({ id: agentId, siteId });
  }

  async getProfile(siteId: string, agentId: string): Promise<AgentProfileDto> {
    const agent = await this.findInSite(siteId, agentId);

    // آمار عملکرد اپراتور — با SQL خام چون یک تجمیع چندجدولی است
    const [stats] = await this.dataSource.query(
      `SELECT
         COUNT(DISTINCT c.id)::int AS "totalConversations",
         COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'resolved')::int AS "resolvedConversations",
         AVG(cs.score)::float AS "avgCsatScore"
       FROM conversations c
       LEFT JOIN csat_ratings cs ON cs."conversationId" = c.id
       WHERE c."siteId" = $1 AND c."assignedAgentId" = $2`,
      [siteId, agentId],
    );

    return {
      ...toDto(agent),
      totalConversations: stats?.totalConversations ?? 0,
      resolvedConversations: stats?.resolvedConversations ?? 0,
      avgCsatScore:
        stats?.avgCsatScore !== null && stats?.avgCsatScore !== undefined
          ? Number(Number(stats.avgCsatScore).toFixed(2))
          : null,
    };
  }

  async updateMyProfile(agentId: string, dto: UpdateMyProfileDto): Promise<AgentDto> {
    const agent = await this.agentsRepository.findOne({ where: { id: agentId } });
    if (!agent) {
      throw new NotFoundException('اپراتور پیدا نشد');
    }
    if (dto.fullName !== undefined) agent.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) agent.phone = dto.phone?.trim() || null;
    if (dto.bio !== undefined) agent.bio = dto.bio?.trim() || null;
    if (dto.avatarUrl !== undefined) agent.avatarUrl = dto.avatarUrl?.trim() || null;
    return toDto(await this.agentsRepository.save(agent));
  }

  async changeMyPassword(agentId: string, dto: ChangePasswordDto): Promise<void> {
    const agent = await this.agentsRepository.findOne({ where: { id: agentId } });
    if (!agent) {
      throw new NotFoundException('اپراتور پیدا نشد');
    }
    const matches = await bcrypt.compare(dto.currentPassword, agent.passwordHash);
    if (!matches) {
      throw new ForbiddenException('رمز عبور فعلی نادرست است');
    }
    if (dto.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`رمز عبور جدید باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد`);
    }
    agent.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.agentsRepository.save(agent);
  }

  private async findInSite(siteId: string, agentId: string): Promise<AgentEntity> {
    const agent = await this.agentsRepository.findOne({ where: { id: agentId, siteId } });
    if (!agent) {
      throw new NotFoundException('اپراتور پیدا نشد');
    }
    return agent;
  }

  // جلوگیری از قفل‌شدن کامل سایت: همیشه باید حداقل یک ادمین باقی بماند
  private async assertNotLastAdmin(siteId: string, excludingAgentId: string): Promise<void> {
    const otherAdmins = await this.agentsRepository.count({
      where: { siteId, role: AgentRole.ADMIN, id: Not(excludingAgentId) },
    });
    if (otherAdmins === 0) {
      throw new BadRequestException('این تنها ادمین سایت است — ابتدا یک ادمین دیگر تعریف کنید');
    }
  }
}

function toDto(agent: AgentEntity): AgentDto {
  return {
    id: agent.id,
    email: agent.email,
    fullName: agent.fullName,
    role: agent.role,
    status: agent.status,
    avatarUrl: agent.avatarUrl,
    phone: agent.phone,
    bio: agent.bio,
    permissions: agent.permissions ?? {},
    twoFactorEnabled: agent.twoFactorEnabled,
    createdAt: agent.createdAt.toISOString(),
  };
}
