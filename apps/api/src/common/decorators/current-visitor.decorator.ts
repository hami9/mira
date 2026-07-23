import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { VisitorTokenPayload } from '../token/token.service';

export const CurrentVisitor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): VisitorTokenPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { visitor: VisitorTokenPayload }>();
    return request.visitor;
  },
);
