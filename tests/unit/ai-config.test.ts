import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it('keeps AvalAI credentials paired with the AvalAI endpoint and model', async () => {
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1');
  vi.stubEnv('OPENAI_MODEL', 'gpt-4o-mini');
  vi.stubEnv('AVALAI_API_KEY', 'fixture-avalai');
  vi.stubEnv('AVALAI_BASE_URL', 'https://api.avalai.ir/v1');
  vi.stubEnv('AVALAI_MODEL', 'deepseek-v4-flash');
  vi.resetModules();
  const { config } = await import('../../apps/worker/src/config');
  expect(config.ai.openaiApiKey).toBe('fixture-avalai');
  expect(config.ai.openaiBaseUrl).toBe('https://api.avalai.ir/v1');
  expect(config.ai.openaiModel).toBe('deepseek-v4-flash');
});

it('preserves an explicitly configured compatible provider', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'fixture-explicit');
  vi.stubEnv('OPENAI_BASE_URL', 'https://provider.test/v1');
  vi.stubEnv('OPENAI_MODEL', 'explicit-model');
  vi.stubEnv('AVALAI_API_KEY', 'fixture-avalai');
  vi.resetModules();
  const { config } = await import('../../apps/worker/src/config');
  expect(config.ai.openaiApiKey).toBe('fixture-explicit');
  expect(config.ai.openaiBaseUrl).toBe('https://provider.test/v1');
  expect(config.ai.openaiModel).toBe('explicit-model');
});
