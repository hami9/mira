import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { SubmitCsatDto } from '@mira/shared-types';

export class SubmitCsatRequestDto implements SubmitCsatDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
