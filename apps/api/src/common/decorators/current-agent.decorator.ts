import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AgentAccessTokenPayload } from '../token/token.service';

export const CurrentAgent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AgentAccessTokenPayload => {
    const request = ctx.switchToHttp().getRequest<Request & { agent: AgentAccessTokenPayload }>();
    return request.agent;
  },
);
