import { IsString, MaxLength, MinLength } from 'class-validator';
import type { CreateCannedResponseDto } from '@mira/shared-types';

export class CreateCannedResponseRequestDto implements CreateCannedResponseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  shortcut!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;
}
