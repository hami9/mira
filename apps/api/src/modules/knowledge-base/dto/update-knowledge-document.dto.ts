import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsByteLength,
  IsIn,
  ValidateIf,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { UpdateKnowledgeDocumentDto } from '@mira/shared-types';

export class UpdateKnowledgeDocumentRequestDto implements UpdateKnowledgeDocumentDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  enabled?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  keywords?: string[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(10)
  @MaxLength(100_000)
  @IsByteLength(10, 80_000)
  content?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['text', 'markdown'])
  sourceType?: 'text' | 'markdown';
}
