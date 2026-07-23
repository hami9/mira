import { IsString, MaxLength, MinLength } from 'class-validator';
import type { CreateKnowledgeDocumentDto } from '@mira/shared-types';

export class CreateKnowledgeDocumentRequestDto implements CreateKnowledgeDocumentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(100_000)
  content!: string;
}
