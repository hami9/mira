import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from '../../database/entities';
import { TokenModule } from '../../common/token/token.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity]), TokenModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
