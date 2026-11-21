import { IsOptional, IsUUID } from 'class-validator';

export class SessionRequestDto {
  @IsOptional()
  @IsUUID()
  agentId?: string;
}
