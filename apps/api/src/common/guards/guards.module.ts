import { Module } from '@nestjs/common';
import { TokenModule } from '../token/token.module';
import { AgentJwtGuard } from './agent-jwt.guard';
import { VisitorJwtGuard } from './visitor-jwt.guard';

@Module({
  imports: [TokenModule],
  providers: [AgentJwtGuard, VisitorJwtGuard],
  // TokenModule هم export می‌شه چون وقتی این گاردها با @UseGuards(ClassRef) در ماژول مصرف‌کننده
  // استفاده می‌شن، Nest وابستگی‌هاشون (TokenService) رو در اسکوپ همون ماژول مصرف‌کننده جست‌وجو می‌کنه
  exports: [AgentJwtGuard, VisitorJwtGuard, TokenModule],
})
export class GuardsModule {}
