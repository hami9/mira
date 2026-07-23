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
} from 'class-validator';
import type {
  BusinessHours,
  TriggerMessageConfig,
  UpdateSiteSettingsDto,
  Weekday,
} from '@mira/shared-types';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

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
  @IsOptional()
  @IsString()
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
  aiSystemPrompt?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  aiConfidenceThreshold?: number;
}
