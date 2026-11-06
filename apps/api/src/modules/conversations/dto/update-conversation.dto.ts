import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateConversationRequestDto {
  @IsOptional() @IsIn(['normal', 'high']) priority?: 'normal' | 'high';
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  @MaxLength(64, { each: true })
  tags?: string[];
}
