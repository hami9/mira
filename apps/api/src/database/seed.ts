import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { AgentRole, AgentStatus } from '@mira/shared-types';
import { AppDataSource } from './data-source';
import { SiteEntity, AgentEntity } from './entities';

// داده‌ی اولیه‌ی نمونه برای تست دستی فاز ۱ — یک سایت (KG Kala) و یک اپراتور ادمین
const DEMO_WIDGET_KEY = 'kgkala-demo-key';
const DEMO_ALLOWED_DOMAINS = ['http://localhost:3000'];
const DEMO_ADMIN_EMAIL = 'admin@kgkala.test';
const DEMO_ADMIN_PASSWORD = 'ChangeMe123!';

async function seed(): Promise<void> {
  await AppDataSource.initialize();

  const siteRepo = AppDataSource.getRepository(SiteEntity);
  const agentRepo = AppDataSource.getRepository(AgentEntity);

  let site = await siteRepo.findOne({ where: { widgetKey: DEMO_WIDGET_KEY } });
  if (!site) {
    site = await siteRepo.save(
      siteRepo.create({
        name: 'KG Kala (نمونه)',
        widgetKey: DEMO_WIDGET_KEY,
        allowedDomains: DEMO_ALLOWED_DOMAINS,
        appearance: { color: '#2563eb', position: 'bottom-end' },
        businessHours: null,
      }),
    );
    console.log(`سایت نمونه ساخته شد — widgetKey: ${site.widgetKey}`);
  } else {
    console.log('سایت نمونه از قبل وجود دارد.');
  }

  const existingAgent = await agentRepo.findOne({ where: { email: DEMO_ADMIN_EMAIL } });
  if (!existingAgent) {
    const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);
    await agentRepo.save(
      agentRepo.create({
        siteId: site.id,
        email: DEMO_ADMIN_EMAIL,
        passwordHash,
        fullName: 'ادمین نمونه',
        role: AgentRole.ADMIN,
        status: AgentStatus.OFFLINE,
      }),
    );
    console.log(`اپراتور ادمین ساخته شد — ایمیل: ${DEMO_ADMIN_EMAIL} / رمز: ${DEMO_ADMIN_PASSWORD}`);
  } else {
    console.log('اپراتور ادمین نمونه از قبل وجود دارد.');
  }

  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('اجرای seed با خطا مواجه شد:', error);
  process.exit(1);
});
