import { IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';

export class StartConversationDto {
  @IsOptional()
  @IsUUID()
  restartFrom?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @MaxLength(1024)
  pageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  pageTitle?: string;
}
