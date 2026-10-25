import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class StartConversationDto {
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @MaxLength(1024)
  pageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  pageTitle?: string;
}
