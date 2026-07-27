import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { AgentRole, AgentStatus } from '@mira/shared-types';
import { AppDataSource } from './data-source';
import { SiteEntity, AgentEntity } from './entities';

// داده‌ی اولیه — یک سایت و یک اپراتور ادمین. idempotent است، پس هر بار بالا آمدن api بی‌خطر اجرا می‌شود.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// در توسعه مقدار پیش‌فرض راحت داریم؛ در پروداکشن اجبار به ست‌کردن env
// تا هیچ استقراری با یک رمز عمومیِ معلوم بالا نیاید (الزام امنیتی فاز ۷).
const SITE_NAME = process.env.SEED_SITE_NAME || 'KG Kala (نمونه)';
const WIDGET_KEY = process.env.SEED_WIDGET_KEY || 'kgkala-demo-key';
const ALLOWED_DOMAINS = (process.env.SEED_ALLOWED_DOMAINS || 'http://localhost:3000')
  .split(',')
  .map((domain) => domain.trim())
  .filter(Boolean);
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@kgkala.test';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'ادمین';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || (IS_PRODUCTION ? '' : 'ChangeMe123!');

async function seed(): Promise<void> {
  if (IS_PRODUCTION && !ADMIN_PASSWORD) {
    console.error(
      'SEED_ADMIN_PASSWORD در محیط production تنظیم نشده است. ' +
        'برای جلوگیری از ساخت حساب ادمین با رمز پیش‌فرضِ معلوم، seed متوقف شد.',
    );
    process.exit(1);
  }

  await AppDataSource.initialize();

  const siteRepo = AppDataSource.getRepository(SiteEntity);
  const agentRepo = AppDataSource.getRepository(AgentEntity);

  let site = await siteRepo.findOne({ where: { widgetKey: WIDGET_KEY } });
  if (!site) {
    site = await siteRepo.save(
      siteRepo.create({
        name: SITE_NAME,
        widgetKey: WIDGET_KEY,
        allowedDomains: ALLOWED_DOMAINS,
        appearance: { color: '#2E6BE6', position: 'bottom-right' },
        businessHours: null,
      }),
    );
    console.log(`سایت ساخته شد — widgetKey: ${site.widgetKey}`);
  } else {
    console.log('سایت از قبل وجود دارد.');
  }

  const existingAgent = await agentRepo.findOne({ where: { email: ADMIN_EMAIL } });
  if (!existingAgent) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await agentRepo.save(
      agentRepo.create({
        siteId: site.id,
        email: ADMIN_EMAIL,
        passwordHash,
        fullName: ADMIN_NAME,
        role: AgentRole.ADMIN,
        status: AgentStatus.OFFLINE,
      }),
    );
    // رمز هیچ‌وقت در لاگ چاپ نمی‌شود (الزام فاز ۷: لاگ نباید توکن/رمز چاپ کند).
    // در توسعه فقط یادآوری می‌کنیم که رمز از کجا می‌آید، نه خودِ رمز.
    console.log(`اپراتور ادمین ساخته شد — ایمیل: ${ADMIN_EMAIL}`);
    if (!IS_PRODUCTION) {
      console.log('رمز عبور: مقدار SEED_ADMIN_PASSWORD یا پیش‌فرض توسعه (به .env.example نگاه کن)');
    }
  } else {
    console.log('اپراتور ادمین از قبل وجود دارد.');
  }

  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('اجرای seed با خطا مواجه شد:', error);
  process.exit(1);
});
