import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { estimateAiCost, parseAiModelPrices } from '@mira/shared-types';
import { BillingService, billingNumber } from '../../apps/api/src/modules/billing/billing.service';

const models = {
  data: [{ id: 'deepseek-test', mode: 'chat', pricing: { input: 0.22, output: 0.66 } }],
};
function setup(config: Record<string, string> = {}) {
  const query = vi
    .fn()
    .mockImplementation(async (sql: string) => (sql.includes('ai_usage') ? [] : [{ id: 'admin' }]));
  const settings = new ConfigService({
    AVALAI_API_KEY: 'fixture-only',
    AVALAI_SITE_ID: 'site-a',
    ...config,
  });
  return { query, service: new BillingService(settings, { query } as unknown as DataSource) };
}
function provider() {
  return vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes('/credit')
            ? { remaining_irt: 100000, exchange_rate: 120000, remaining_unit: 0.5 }
            : url.includes('/summary')
              ? {
                  totals: {
                    transactions: 2,
                    tokens: { total: 300 },
                    cost: { unit: '0.002', paid_irt: '240' },
                  },
                  by_model: [
                    { model: 'deepseek-test', transactions: 2, tokens: 300, cost_unit: '0.002' },
                  ],
                }
              : models,
        ),
        { status: 200 },
      ),
  );
}
afterEach(() => vi.unstubAllGlobals());

describe('AI cost calculation', () => {
  it('uses per-million token pricing and bounded integer counts', () => {
    const price = parseAiModelPrices(models)[0];
    expect(estimateAiCost(price, 1500, 400, 1000)).toBeCloseTo(0.594);
    for (const n of [NaN, Infinity, -1, 0.5, 1e10])
      expect(estimateAiCost(price, n, 1, 1)).toBeNull();
  });
  it('applies published long-context rates above the threshold', () => {
    const [price] = parseAiModelPrices({
      data: [
        {
          id: 'luna',
          pricing: { input: 0.1, output: 0.5, input_above_272K: 0.2, output_above_272K: 0.75 },
        },
      ],
    });
    expect(estimateAiCost(price, 272000, 1000, 1)).toBeCloseTo(0.0277);
    expect(estimateAiCost(price, 300000, 1000, 1)).toBeCloseTo(0.06075);
  });
  it('does not replace missing financial values with zero', () => {
    for (const n of [null, undefined, '', ' ', 'NaN', Infinity])
      expect(billingNumber(n)).toBeNull();
    expect(billingNumber('0')).toBe(0);
    expect(billingNumber('-20', true)).toBe(-20);
  });
  it('ignores unsupported and invalid tariffs', () => {
    expect(
      parseAiModelPrices({
        data: [
          null,
          { id: 'image', mode: 'image_generation', pricing: { input: 1, output: 1 } },
          { id: 'bad', pricing: { input: -1, output: 1 } },
          { id: 'unknown' },
        ],
      }),
    ).toEqual([]);
    expect(
      parseAiModelPrices({
        data: [
          {
            id: 'luna-test',
            extra: { metadata: { mode: 'chat' }, pricing: { input: 0.1, output: 0.5 } },
          },
        ],
      }),
    ).toHaveLength(1);
  });
});

describe('AvalAI billing boundary', () => {
  it('reconciles only pending request IDs for the bound site', async () => {
    const { service, query } = setup();
    query.mockImplementation(async (sql: string) =>
      sql.startsWith('SELECT "requestId"')
        ? [{ requestId: 'fixture-request' }]
        : sql.startsWith('SELECT id')
          ? [{ id: 'admin' }]
          : [],
    );
    const fallback = provider();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit) => {
        if (!url.endsWith('/lookup')) return fallback(url);
        expect(JSON.parse(String(options.body))).toEqual({ transaction_ids: ['fixture-request'] });
        return new Response(
          JSON.stringify({
            transactions: [
              { id: 'fixture-request', cost: { unit: '0.00012' } },
              { id: 'foreign-request', cost: { unit: '99' } },
            ],
          }),
        );
      }),
    );
    await service.overview('site-a', 'admin');
    const updates = query.mock.calls.filter((call) => call[0].startsWith('UPDATE ai_usage'));
    expect(updates).toHaveLength(1);
    expect(updates[0][1]).toEqual([0.00012, 'site-a', 'fixture-request']);
  });
  it('reads balances and charges from the provider and caches calls', async () => {
    const fetcher = provider();
    vi.stubGlobal('fetch', fetcher);
    const { service, query } = setup();
    const result = await service.overview('site-a', 'admin');
    expect(result.credit?.remainingIrt).toBe(100000);
    expect(result.usage?.costUsd).toBe(0.002);
    expect(result.models[0].inputPerMillion).toBe(0.22);
    expect(JSON.stringify(result)).not.toContain('fixture-only');
    await service.overview('site-a', 'admin');
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('"siteId" = $2'), [
      'admin',
      'site-a',
    ]);
  });
  it('does not expose account data to a different site', async () => {
    const fetcher = provider();
    vi.stubGlobal('fetch', fetcher);
    const { service } = setup();
    await service.overview('site-a', 'admin');
    const other = await service.overview('site-b', 'admin');
    expect(other.configured).toBe(false);
    expect(other.credit).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('checks fresh admin rights before returning even cached information', async () => {
    vi.stubGlobal('fetch', provider());
    const { service, query } = setup();
    await service.overview('site-a', 'admin');
    query.mockResolvedValueOnce([]);
    await expect(service.overview('site-a', 'admin')).rejects.toMatchObject({ status: 403 });
  });
  it('does not send a key to an unapproved host', async () => {
    const fetcher = provider();
    vi.stubGlobal('fetch', fetcher);
    const { service } = setup({ AVALAI_BASE_URL: 'https://evil.test/v1' });
    const result = await service.overview('site-a', 'admin');
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.credit).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  it('keeps unavailable balance and usage unknown on provider failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unavailable')));
    const result = await setup().service.overview('site-a', 'admin');
    expect(result.credit).toBeNull();
    expect(result.usage).toBeNull();
    expect(result.warnings).toHaveLength(3);
  });
});
