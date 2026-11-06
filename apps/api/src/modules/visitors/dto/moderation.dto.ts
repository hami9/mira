import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { ModerateVisitorDto, UpdateVisitorDetailsDto, VisitorFlag } from '@mira/shared-types';
class VisitorFlagDto implements VisitorFlag {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,64}$/) id!: string;
  @IsString() @MinLength(1) @MaxLength(32) label!: string;
  @IsIn(['red', 'amber', 'green', 'blue', 'violet', 'slate']) color!: VisitorFlag['color'];
}
export class UpdateVisitorDetailsRequestDto implements UpdateVisitorDetailsDto {
  @IsOptional() @IsString() @MaxLength(255) displayName?: string | null;
  @ValidateIf((dto: UpdateVisitorDetailsRequestDto) => dto.flags !== undefined)
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique((flag: VisitorFlagDto) => flag.id)
  @ValidateNested({ each: true })
  @Type(() => VisitorFlagDto)
  flags?: VisitorFlagDto[];
}
export class ModerateVisitorRequestDto implements ModerateVisitorDto {
  @IsIn(['block', 'unblock', 'mute', 'unmute']) action!: ModerateVisitorDto['action'];
  @ValidateIf(
    (dto: ModerateVisitorRequestDto) => dto.action === 'mute' || dto.durationMinutes !== undefined,
  )
  @IsInt()
  @Min(1)
  @Max(10080)
  durationMinutes?: number;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
