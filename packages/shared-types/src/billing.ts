export interface AiModelPrice {
  id: string;
  inputPerMillion: number;
  outputPerMillion: number;
  tiers?: { aboveTokens: number; inputPerMillion: number; outputPerMillion: number }[];
}

export interface AiUsageContext {
  siteId: string;
  conversationId?: string;
  agentId?: string;
  kind: 'reply' | 'suggestion' | 'summary' | 'retrieval' | 'document';
}

export interface AiUsageReport {
  days: number;
  requests: number;
  failedRequests: number;
  totalTokens: number | null;
  unknownRequests: number;
  users: number;
  userTokens: number | null;
  averageTokensPerUser: number | null;
  recordedCostUsd: number | null;
  pendingCosts: number;
  visitors: {
    id: string;
    name: string;
    requests: number;
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    costUsd: number | null;
    pendingCosts: number;
  }[];
}

export interface AiBillingDto {
  configured: boolean;
  checkedAt: string;
  topUpUrl: string;
  credit: {
    remainingIrt: number | null;
    remainingUsd: number | null;
    exchangeRate: number | null;
  } | null;
  usage: {
    requests: number | null;
    tokens: number | null;
    costUsd: number | null;
    paidIrt: number | null;
    models: {
      id: string;
      requests: number | null;
      tokens: number | null;
      costUsd: number | null;
    }[];
  } | null;
  models: AiModelPrice[];
  warnings: string[];
}

export function estimateAiCost(
  model: AiModelPrice,
  inputTokens: number,
  outputTokens: number,
  requests: number,
): number | null {
  const values = [
    model.inputPerMillion,
    model.outputPerMillion,
    inputTokens,
    outputTokens,
    requests,
  ];
  if (values.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (
    [inputTokens, outputTokens, requests].some((n) => !Number.isSafeInteger(n) || n > 1_000_000_000)
  )
    return null;
  const tier =
    model.tiers
      ?.filter((item) => inputTokens > item.aboveTokens)
      .sort((a, b) => b.aboveTokens - a.aboveTokens)[0] ?? model;
  if (![tier.inputPerMillion, tier.outputPerMillion].every((n) => Number.isFinite(n) && n >= 0))
    return null;
  const cost =
    ((inputTokens * tier.inputPerMillion + outputTokens * tier.outputPerMillion) * requests) /
    1_000_000;
  return Number.isFinite(cost) ? cost : null;
}

export function parseAiModelPrices(raw: unknown): AiModelPrice[] {
  const value = raw as { data?: unknown[]; models?: unknown[] } | null;
  const rows = Array.isArray(raw) ? raw : (value?.data ?? value?.models);
  if (!Array.isArray(rows)) return [];
  const models = new Map<string, AiModelPrice>();
  for (const row of rows.slice(0, 3000)) {
    const item = row as {
      id?: unknown;
      mode?: unknown;
      pricing?: Record<string, unknown>;
      extra?: { metadata?: { mode?: unknown }; pricing?: Record<string, unknown> };
    } | null;
    const pricing = item?.pricing ?? item?.extra?.pricing;
    const mode = item?.mode ?? item?.extra?.metadata?.mode;
    if (
      typeof item?.id !== 'string' ||
      item.id.length > 150 ||
      (mode && mode !== 'chat') ||
      !pricing
    )
      continue;
    const input = pricing.input;
    const output = pricing.output;
    if (
      typeof input !== 'number' ||
      typeof output !== 'number' ||
      !Number.isFinite(input) ||
      !Number.isFinite(output) ||
      input < 0 ||
      output < 0
    )
      continue;
    const tiers: NonNullable<AiModelPrice['tiers']> = [];
    for (const [key, value] of Object.entries(pricing)) {
      const match = /^input_above_(\d+)([km]?)$/i.exec(key);
      const tierOutput = pricing[key.replace(/^input/, 'output')];
      if (
        !match ||
        typeof value !== 'number' ||
        typeof tierOutput !== 'number' ||
        ![value, tierOutput].every((n) => Number.isFinite(n) && n >= 0)
      )
        continue;
      const aboveTokens =
        Number(match[1]) *
        (match[2].toLowerCase() === 'k' ? 1000 : match[2].toLowerCase() === 'm' ? 1000000 : 1);
      tiers.push({ aboveTokens, inputPerMillion: value, outputPerMillion: tierOutput });
    }
    models.set(item.id, {
      id: item.id,
      inputPerMillion: input,
      outputPerMillion: output,
      ...(tiers.length ? { tiers } : {}),
    });
  }
  return [...models.values()].sort(
    (a, b) => a.inputPerMillion + a.outputPerMillion - (b.inputPerMillion + b.outputPerMillion),
  );
}
