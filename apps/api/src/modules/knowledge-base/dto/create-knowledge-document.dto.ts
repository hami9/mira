import {
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  IsIn,
  IsByteLength,
} from 'class-validator';
import type { CreateKnowledgeDocumentDto } from '@mira/shared-types';

export class CreateKnowledgeDocumentRequestDto implements CreateKnowledgeDocumentDto {
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
  @IsIn(['text', 'markdown'])
  sourceType?: 'text' | 'markdown';

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(100_000)
  @IsByteLength(10, 80_000)
  content!: string;
}
