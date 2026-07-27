import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from '../../database/entities';
import { PermissionGuard } from './require-permission.decorator';
import { GuardsModule } from './guards.module';

// Global چون @RequirePermission در تقریباً همه‌ی ماژول‌های ویژگی استفاده می‌شه؛ بدون این،
// باید AgentEntity و PermissionGuard رو در هر ماژول جداگانه ثبت می‌کردیم (تکرار بی‌فایده).
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity]), GuardsModule],
  providers: [PermissionGuard],
  exports: [PermissionGuard, GuardsModule, TypeOrmModule],
})
export class PermissionsModule {}
