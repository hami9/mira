import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import type { WidgetSessionRequestDto } from '@mira/shared-types';

export class WidgetSessionDto implements WidgetSessionRequestDto {
  @IsString()
  @MaxLength(64)
  widgetKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  visitorRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
