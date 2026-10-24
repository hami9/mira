import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  ValidateNested,
  ArrayMaxSize,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type {
  BusinessHours,
  TriggerMessageConfig,
  UpdateSiteSettingsDto,
  Weekday,
  AiPolicy,
} from '@mira/shared-types';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

class AiPolicyDto implements AiPolicy {
  @IsBoolean()
  useKnowledgeBase!: boolean;

  @IsBoolean()
  useWebsite!: boolean;

  @IsBoolean()
  useProducts!: boolean;

  @IsBoolean()
  showSources!: boolean;

  @IsNumber()
  @Min(0)
  @Max(1)
  minSimilarity!: number;

  @IsInt()
  @Min(1)
  @Max(6)
  maxProducts!: number;

  @IsInt()
  @Min(100)
  @Max(8000)
  maxInputChars!: number;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  blockedTopics!: string[];

  @IsString()
  @MaxLength(8000)
  serverContext!: string;

  @IsString()
  @MaxLength(120)
  @Matches(/^[a-zA-Z0-9._:/-]*$/)
  model!: string;

  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  quickReplies!: string[];
}

class BusinessHoursDayDto {
  @IsBoolean()
  enabled!: boolean;

  @Matches(TIME_PATTERN, { message: 'فرمت ساعت باید HH:mm باشد' })
  start!: string;

  @Matches(TIME_PATTERN, { message: 'فرمت ساعت باید HH:mm باشد' })
  end!: string;
}

class BusinessHoursDto implements BusinessHours {
  @IsObject()
  days!: Record<Weekday, BusinessHoursDayDto>;
}

class TriggerMessageDto implements TriggerMessageConfig {
  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  @Min(1)
  @Max(600)
  delaySeconds!: number;

  @IsString()
  text!: string;
}

export class UpdateSiteSettingsRequestDto implements UpdateSiteSettingsDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => AiPolicyDto)
  aiPolicy?: AiPolicyDto;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/\S/, { message: 'نام فروشگاه نمی‌تواند خالی باشد' })
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedDomains?: string[];

  @IsOptional()
  @IsObject()
  appearance?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessHoursDto)
  businessHours?: BusinessHoursDto | null;

  @IsOptional()
  @IsString()
  offlineMessage?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => TriggerMessageDto)
  triggerMessage?: TriggerMessageDto;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'آدرس سایت وردپرس معتبر نیست' })
  wordpressSiteUrl?: string | null;

  @IsOptional()
  @IsString()
  wordpressApiKey?: string | null;

  @IsOptional()
  @IsBoolean()
  aiEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  aiSystemPrompt?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  aiConfidenceThreshold?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  aiBotName?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  @MaxLength(1024)
  aiBotAvatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  aiGreetingMessage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  aiHandoffMessage?: string | null;

  // بالاتر از ۱ برای یک ربات پشتیبانی معنی ندارد (پاسخ‌ها بی‌ثبات و غیرقابل‌اتکا می‌شوند)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  aiTemperature?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(4000)
  aiMaxTokens?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  aiMaxRepliesPerConversation?: number;

  @IsOptional()
  @IsBoolean()
  aiReplyOnlyOutsideBusinessHours?: boolean;
}
