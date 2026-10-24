// تعداد کارهای هم‌زمان میان همه‌ی صف‌ها مشترک است؛ هر صف هنوز پردازشگر مستقل دارد.
export function createTaskLimiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}
