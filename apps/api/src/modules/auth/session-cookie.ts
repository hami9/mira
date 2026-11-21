// نشست داشبورد در کوکی HttpOnly می‌ماند تا با رفرش حفظ شود و جاوااسکریپت صفحه به توکن تمدید دسترسی نداشته باشد.
export const SESSION_COOKIE_PATH = '/v1/auth';
export const SESSION_MARKER_HEADER = 'x-mira-session';

const COOKIE_PATTERN = /^mira_rt_[0-9a-f]{32}$/;
const MAX_SESSION_COOKIES = 10;
const MAX_TOKEN_LENGTH = 2048;

export interface SessionCookie {
  name: string;
  token: string;
}

export interface RestoredSession {
  agentId: string;
  accessToken: string;
}

export interface RestoreDependencies<Agent extends { id: string }> {
  verify: (token: string) => { sub: string; type: string };
  loadAgents: (ids: string[]) => Promise<Agent[]>;
  signAccess: (agent: Agent) => string;
}

export function sessionCookieName(agentId: string): string {
  return `mira_rt_${agentId.replace(/-/g, '').toLowerCase()}`;
}

export function readSessionCookies(header: string | undefined): SessionCookie[] {
  if (!header) return [];
  const cookies = new Map<string, string>();
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const token = part.slice(separator + 1).trim();
    if (!COOKIE_PATTERN.test(name) || !token || token.length > MAX_TOKEN_LENGTH) continue;
    cookies.set(name, token);
    if (cookies.size >= MAX_SESSION_COOKIES) break;
  }
  return [...cookies].map(([name, token]) => ({ name, token }));
}

// هدر سفارشی و تطبیق Origin با Host جلوی استفاده‌ی سایت دیگر از کوکی را می‌گیرد.
export function isTrustedSessionRequest(request: {
  marker?: string;
  origin?: string;
  host?: string;
}): boolean {
  if (request.marker !== '1' || !request.origin || !request.host) return false;
  try {
    return (
      new URL(request.origin).hostname.toLowerCase() ===
      new URL(`http://${request.host}`).hostname.toLowerCase()
    );
  } catch {
    return false;
  }
}

export async function restoreSessionsFromCookies<Agent extends { id: string }>(
  cookies: SessionCookie[],
  requestedAgentId: string | undefined,
  dependencies: RestoreDependencies<Agent>,
): Promise<{ sessions: RestoredSession[]; staleCookies: string[] }> {
  const candidates = requestedAgentId
    ? cookies.filter((cookie) => cookie.name === sessionCookieName(requestedAgentId))
    : cookies;
  const staleCookies: string[] = [];
  const valid: { name: string; agentId: string }[] = [];
  for (const cookie of candidates) {
    try {
      const payload = dependencies.verify(cookie.token);
      if (payload.type === 'agent_refresh' && sessionCookieName(payload.sub) === cookie.name)
        valid.push({ name: cookie.name, agentId: payload.sub });
      else staleCookies.push(cookie.name);
    } catch {
      staleCookies.push(cookie.name);
    }
  }
  if (!valid.length) return { sessions: [], staleCookies };
  // خطای موقت دیتابیس بالا می‌رود تا کوکی معتبر به‌اشتباه پاک نشود.
  const agents = await dependencies.loadAgents(valid.map((item) => item.agentId));
  const sessions: RestoredSession[] = [];
  for (const item of valid) {
    const agent = agents.find((candidate) => candidate.id === item.agentId);
    if (!agent) staleCookies.push(item.name);
    else sessions.push({ agentId: agent.id, accessToken: dependencies.signAccess(agent) });
  }
  return { sessions, staleCookies };
}
