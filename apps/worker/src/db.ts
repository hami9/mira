import { Pool } from 'pg';
import { config } from './config';

// worker مستقیم با SQL خام کار می‌کنه (نه TypeORM entities) تا از import کردن کد apps/api
// جلوگیری شه — تنها وابستگی مشترک بین دو اپ، shared-types (بدون وابستگی به دیتابیس) است.
export const pool = new Pool({ connectionString: config.databaseUrl });
