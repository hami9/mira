import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './token.service';

// سکرت/انقضا برای هر نوع توکن به‌صورت جدا در TokenService پاس داده می‌شه،
// پس این ماژول با تنظیمات پیش‌فرض خالی رجیستر می‌شه
@Module({
  imports: [JwtModule.register({})],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
