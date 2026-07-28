import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AutomationRuleDto,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
  splitKeywords,
} from '@mira/shared-types';
import { AutomationRuleEntity } from '../../database/entities';
import { ConversationsService } from '../conversations/conversations.service';

@Injectable()
export class AutomationService {
  constructor(
    @InjectRepository(AutomationRuleEntity)
    private readonly rulesRepository: Repository<AutomationRuleEntity>,
    private readonly conversationsService: ConversationsService,
  ) {}

  async listForSite(siteId: string): Promise<AutomationRuleDto[]> {
    const rules = await this.rulesRepository.find({
      where: { siteId },
      order: { createdAt: 'ASC' },
    });
    return rules.map(toDto);
  }

  async create(siteId: string, dto: CreateAutomationRuleDto): Promise<AutomationRuleDto> {
    const rule = this.rulesRepository.create({
      siteId,
      name: dto.name,
      triggerType: 'keyword_in_message',
      triggerValue: dto.triggerValue,
      actionType: dto.actionType,
      actionValue: dto.actionValue ?? null,
      enabled: true,
    });
    return toDto(await this.rulesRepository.save(rule));
  }

  async update(
    siteId: string,
    id: string,
    dto: UpdateAutomationRuleDto,
  ): Promise<AutomationRuleDto> {
    const rule = await this.rulesRepository.findOne({ where: { id, siteId } });
    if (!rule) {
      throw new NotFoundException('قانون اتوماسیون پیدا نشد');
    }
    if (dto.name !== undefined) rule.name = dto.name;
    if (dto.triggerValue !== undefined) rule.triggerValue = dto.triggerValue;
    if (dto.actionType !== undefined) rule.actionType = dto.actionType;
    if (dto.actionValue !== undefined) rule.actionValue = dto.actionValue;
    if (dto.enabled !== undefined) rule.enabled = dto.enabled;
    return toDto(await this.rulesRepository.save(rule));
  }

  async delete(siteId: string, id: string): Promise<void> {
    await this.rulesRepository.delete({ id, siteId });
  }

  // روی هر پیام تازه‌ی بازدیدکننده اجرا می‌شه (مسیر زنده‌ی چت) — فقط کلیدواژه‌ست، پس ارزون و فوری‌ست
  async evaluateAndApply(
    siteId: string,
    conversationId: string,
    messageContent: string,
  ): Promise<void> {
    const rules = await this.rulesRepository.find({ where: { siteId, enabled: true } });
    if (rules.length === 0) return;

    const normalizedMessage = messageContent.toLowerCase();
    const effects: { department?: string; addTags: string[]; setPriorityHigh: boolean } = {
      addTags: [],
      setPriorityHigh: false,
    };
    let matchedAny = false;

    for (const rule of rules) {
      // منطق جداسازی (پذیرش «،» فارسی در کنار «,») در shared-types است تا تست‌پذیر بماند
      const keywords = splitKeywords(rule.triggerValue);
      const matched = keywords.some((keyword) => normalizedMessage.includes(keyword));
      if (!matched) continue;

      matchedAny = true;
      if (rule.actionType === 'set_department' && rule.actionValue) {
        effects.department = rule.actionValue;
      } else if (rule.actionType === 'add_tag' && rule.actionValue) {
        effects.addTags.push(rule.actionValue);
      } else if (rule.actionType === 'set_priority_high') {
        effects.setPriorityHigh = true;
      }
    }

    if (matchedAny) {
      await this.conversationsService.applyAutomationEffects(conversationId, siteId, effects);
    }
  }
}

function toDto(rule: AutomationRuleEntity): AutomationRuleDto {
  return {
    id: rule.id,
    name: rule.name,
    triggerType: rule.triggerType,
    triggerValue: rule.triggerValue,
    actionType: rule.actionType,
    actionValue: rule.actionValue,
    enabled: rule.enabled,
    createdAt: rule.createdAt.toISOString(),
  };
}
