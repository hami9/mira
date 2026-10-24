import { describe, expect, it } from 'vitest';
import { runtimeLimits } from '../../packages/shared-types/src/runtime';
import { createTaskLimiter } from '../../apps/worker/src/task-limit';

describe('runtime limits', () => {
  it('uses bounded defaults and rejects invalid deployment values', () => {
    expect(runtimeLimits({})).toEqual({ apiPool: 5, workerPool: 3, workerConcurrency: 2 });
    for (const value of ['0', '-1', '1.5', 'NaN', '51'])
      expect(() => runtimeLimits({ API_DB_POOL_MAX: value })).toThrow('API_DB_POOL_MAX');
    expect(runtimeLimits({ API_DB_POOL_MAX: '8', WORKER_CONCURRENCY: '1' }).apiPool).toBe(8);
    expect(() => runtimeLimits({ WORKER_DB_POOL_MAX: '2' })).toThrow('WORKER_DB_POOL_MAX');
  });

  it('caps all concurrent jobs together and releases capacity after failure', async () => {
    const run = createTaskLimiter(2);
    let active = 0;
    let peak = 0;
    const releases: (() => void)[] = [];
    const jobs = Array.from({ length: 5 }, (_, index) =>
      run(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise<void>((resolve) => releases.push(resolve));
        active--;
        if (index === 0) throw new Error('fixture');
        return index;
      }),
    );
    const results = Promise.allSettled(jobs);
    expect(active).toBe(2);
    for (let i = 0; i < 5; i++) {
      releases.shift()!();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(active).toBeLessThanOrEqual(2);
    }
    expect(peak).toBe(2);
    expect((await results).filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await run(async () => 'ready')).toBe('ready');
  });
});
