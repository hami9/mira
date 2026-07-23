import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { UpdateCannedResponseDto } from '@mira/shared-types';

export class UpdateCannedResponseRequestDto implements UpdateCannedResponseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  shortcut?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;
}
