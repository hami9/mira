import { getHeapStatistics } from 'v8';
import { writeWorkerStatus } from './redis-bridge';

export function startTelemetry(): () => void {
  let cpu = process.cpuUsage();
  let time = process.hrtime.bigint();
  let pending = false;
  async function report() {
    if (pending) return;
    pending = true;
    const now = process.hrtime.bigint();
    const usage = process.cpuUsage(cpu);
    const elapsed = Number(now - time) / 1000;
    cpu = process.cpuUsage();
    time = now;
    const memory = process.memoryUsage();
    try {
      await writeWorkerStatus({
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapLimitBytes: getHeapStatistics().heap_size_limit,
        cpuPercent: elapsed > 0 ? ((usage.user + usage.system) / elapsed) * 100 : null,
        uptimeSeconds: process.uptime(),
        checkedAt: new Date().toISOString(),
      });
    } catch {
      // گزارش منابع اختیاری است؛ خرابی آن نباید پردازش صف را متوقف کند.
    } finally {
      pending = false;
    }
  }
  void report();
  const timer = setInterval(() => void report(), 15_000);
  timer.unref();
  return () => clearInterval(timer);
}
