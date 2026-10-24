// نقطه ورود پنل میزبانی؛ سرور HTTP در همین پردازش و صف AI در پردازش مستقل اجرا می‌شود.
const { fork } = require('node:child_process');
const { join } = require('node:path');
require('dotenv').config({ path: join(__dirname, '.env') });

process.env.NODE_ENV = 'production';
process.env.SERVE_DASHBOARD = 'true';
process.env.API_DB_POOL_MAX ||= '5';
process.env.WORKER_DB_POOL_MAX ||= '3';
process.env.WORKER_CONCURRENCY ||= '2';

let worker;
let stopping = false;
const initialize = fork(join(__dirname, 'apps/api/dist/database/init.js'), [], {
  stdio: 'inherit',
  execArgv: ['--max-old-space-size=192'],
});
initialize.on('error', fail);
initialize.on('exit', (code) => {
  if (stopping) return;
  if (code !== 0) return fail();
  require('./apps/api/dist/main.js');
  worker = fork(join(__dirname, 'apps/worker/dist/main.js'), [], {
    stdio: 'inherit',
    execArgv: ['--max-old-space-size=160'],
  });
  worker.on('error', fail);
  worker.on('exit', () => {
    if (!stopping) fail();
  });
});

function fail() {
  console.error('راه‌اندازی میرا ناموفق بود؛ وضعیت برنامه و تنظیمات میزبان را بررسی کنید.');
  process.exit(1);
}
function stop() {
  if (stopping) return;
  stopping = true;
  initialize.kill('SIGTERM');
  worker?.kill('SIGTERM');
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
process.on('exit', () => {
  initialize.kill('SIGTERM');
  worker?.kill('SIGTERM');
});
