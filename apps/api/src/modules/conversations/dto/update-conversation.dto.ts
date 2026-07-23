import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateConversationRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
