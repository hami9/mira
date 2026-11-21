import { describe, expect, it, vi } from 'vitest';
import {
  isTrustedSessionRequest,
  readSessionCookies,
  restoreSessionsFromCookies,
  sessionCookieName,
} from '../../apps/api/src/modules/auth/session-cookie';

const agentA = '11111111-1111-4111-8111-111111111111';
const agentB = '22222222-2222-4222-8222-222222222222';
const cookie = (agentId: string, token: string) => ({
  name: sessionCookieName(agentId),
  token,
});
const deps = (known = [agentA, agentB]) => ({
  verify: vi.fn((token: string) => {
    if (token.startsWith('bad')) throw new Error('invalid');
    const [sub, type = 'agent_refresh'] = token.split('|');
    return { sub, type };
  }),
  loadAgents: vi.fn(async (ids: string[]) =>
    ids
      .filter((id) => known.includes(id))
      .map((id) => ({ id, siteId: `site-${id[0]}`, role: 'admin' })),
  ),
  signAccess: vi.fn((agent: { id: string }) => `access-${agent.id[0]}`),
});

describe('session cookies', () => {
  it('reads only well-formed Mira session cookies', () => {
    const header = [
      `${sessionCookieName(agentA)}=token-a`,
      'other=value',
      'mira_rt_short=value',
      `${sessionCookieName(agentB)}=`,
    ].join('; ');
    expect(readSessionCookies(header)).toEqual([cookie(agentA, 'token-a')]);
    expect(readSessionCookies(undefined)).toEqual([]);
  });

  it('bounds the number of cookies processed per request', () => {
    const header = Array.from(
      { length: 25 },
      (_, index) => `mira_rt_${String(index).padStart(32, '0')}=token`,
    ).join('; ');
    expect(readSessionCookies(header)).toHaveLength(10);
  });

  it('accepts only marked same-host browser requests', () => {
    const trusted = { marker: '1', origin: 'https://mira.test', host: 'mira.test' };
    expect(isTrustedSessionRequest(trusted)).toBe(true);
    expect(isTrustedSessionRequest({ ...trusted, host: 'mira.test:3300' })).toBe(true);
    for (const request of [
      { ...trusted, marker: undefined },
      { ...trusted, origin: undefined },
      { ...trusted, origin: 'https://evil.test' },
      { ...trusted, origin: 'https://mira.test.evil.test' },
      { ...trusted, origin: 'not a url' },
      { ...trusted, host: undefined },
    ])
      expect(isTrustedSessionRequest(request)).toBe(false);
  });

  it('restores every valid store session with fresh access tokens', async () => {
    const result = await restoreSessionsFromCookies(
      [cookie(agentA, `${agentA}|agent_refresh`), cookie(agentB, `${agentB}|agent_refresh`)],
      undefined,
      deps(),
    );
    expect(result.sessions).toEqual([
      { agentId: agentA, accessToken: 'access-1' },
      { agentId: agentB, accessToken: 'access-2' },
    ]);
    expect(result.staleCookies).toEqual([]);
  });

  it('refreshes only the requested store', async () => {
    const dependencies = deps();
    const result = await restoreSessionsFromCookies(
      [cookie(agentA, `${agentA}|agent_refresh`), cookie(agentB, `${agentB}|agent_refresh`)],
      agentB,
      dependencies,
    );
    expect(result.sessions.map((session) => session.agentId)).toEqual([agentB]);
    expect(dependencies.verify).toHaveBeenCalledTimes(1);
  });

  it('marks invalid, mismatched, wrong-type and deleted-agent cookies as stale', async () => {
    const cookies = [
      cookie(agentA, 'bad-token'),
      { name: sessionCookieName(agentB), token: `${agentA}|agent_refresh` },
      { name: `mira_rt_${'3'.repeat(32)}`, token: `${'3'.repeat(32)}|agent_access` },
      cookie('44444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444'),
    ];
    const result = await restoreSessionsFromCookies(cookies, undefined, deps());
    expect(result.sessions).toEqual([]);
    expect(result.staleCookies).toEqual(cookies.map((item) => item.name));
  });

  it('keeps cookies when the database is temporarily unavailable', async () => {
    const dependencies = deps();
    dependencies.loadAgents.mockRejectedValueOnce(new Error('db down'));
    await expect(
      restoreSessionsFromCookies(
        [cookie(agentA, `${agentA}|agent_refresh`)],
        undefined,
        dependencies,
      ),
    ).rejects.toThrow('db down');
  });
});
