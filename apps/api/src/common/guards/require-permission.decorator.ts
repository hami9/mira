import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentPermission, PERMISSION_LABELS, hasPermission } from '@mira/shared-types';
import { AgentEntity } from '../../database/entities';
import { AgentAccessTokenPayload } from '../token/token.service';
import { AgentJwtGuard } from './agent-jwt.guard';

export const PERMISSION_KEY = 'requiredPermission';

// دسترسی‌ها در توکن JWT نیستند (تا تغییرشان توسط ادمین فوراً اثر کند و منتظر انقضای توکن نمانَد)،
// پس این گارد نقش/دسترسی را هر بار تازه از دیتابیس می‌خواند.
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(AgentEntity)
    private readonly agentsRepository: Repository<AgentEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<AgentPermission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { agent?: AgentAccessTokenPayload }>();
    const tokenAgent = request.agent;
    if (!tokenAgent) {
      throw new ForbiddenException('احراز هویت نامعتبر است');
    }

    const agent = await this.agentsRepository.findOne({ where: { id: tokenAgent.sub } });
    if (!agent) {
      throw new ForbiddenException('اپراتور پیدا نشد');
    }

    if (!hasPermission(agent.role, agent.permissions, required)) {
      throw new ForbiddenException(`شما دسترسی «${PERMISSION_LABELS[required]}» را ندارید`);
    }
    return true;
  }
}

// ترکیب گارد احراز هویت + گارد دسترسی در یک دکوراتور، تا در کنترلرها تکرار نشود
export function RequirePermission(permission: AgentPermission) {
  return applyDecorators(
    SetMetadata(PERMISSION_KEY, permission),
    UseGuards(AgentJwtGuard, PermissionGuard),
  );
}
