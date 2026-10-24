import { AppDataSource } from './data-source';

async function initialize(): Promise<void> {
  await AppDataSource.initialize();
  // چند نمونه برنامه ممکن است هم‌زمان بالا بیایند؛ مایگریشن‌ها باید سری اجرا شوند.
  const runner = AppDataSource.createQueryRunner();
  await runner.connect();
  try {
    await runner.query('SELECT pg_advisory_lock(78321409)');
    await AppDataSource.runMigrations();
  } finally {
    await runner.query('SELECT pg_advisory_unlock(78321409)');
    await runner.release();
    await AppDataSource.destroy();
  }
  await import('./seed');
}

initialize().catch(() => {
  console.error('آماده‌سازی دیتابیس ناموفق بود؛ تنظیمات و دسترسی دیتابیس را بررسی کنید.');
  process.exit(1);
});
