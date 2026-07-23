import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { ReportPageViewDto } from '@mira/shared-types';

export class ReportPageViewRequestDto implements ReportPageViewDto {
  @IsString()
  @MaxLength(1024)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}
