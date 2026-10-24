export interface RuntimeLimits {
  apiPool: number;
  workerPool: number;
  workerConcurrency: number;
}

export function runtimeLimits(env: Record<string, unknown>): RuntimeLimits {
  function integer(key: string, fallback: number, max: number): number {
    const value = env[key];
    if (value === undefined || value === '') return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > max)
      throw new Error(`مقدار ${key} باید عدد صحیح بین ۱ و ${max} باشد`);
    return number;
  }
  const limits = {
    apiPool: integer('API_DB_POOL_MAX', 5, 50),
    workerPool: integer('WORKER_DB_POOL_MAX', 3, 30),
    workerConcurrency: integer('WORKER_CONCURRENCY', 2, 10),
  };
  // ثبت مصرف AI از اتصال جدا استفاده می‌کند؛ همه اتصال‌ها نباید در انتظار مدل قفل بمانند.
  if (limits.workerPool <= limits.workerConcurrency)
    throw new Error('WORKER_DB_POOL_MAX باید از WORKER_CONCURRENCY بزرگ‌تر باشد');
  return limits;
}

export interface ProcessSnapshot {
  rssBytes: number;
  heapUsedBytes: number;
  heapLimitBytes: number;
  cpuPercent: number | null;
  uptimeSeconds: number;
}

export interface SystemStatusDto {
  authorized: boolean;
  checkedAt: string;
  limits: RuntimeLimits | null;
  api: ProcessSnapshot | null;
  worker: (ProcessSnapshot & { checkedAt: string }) | null;
  databaseBytes: number | null;
  warnings: string[];
}
