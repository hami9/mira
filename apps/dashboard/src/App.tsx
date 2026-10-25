import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClient } from './api';
import { ApiProvider } from './api-context';
import { Dashboard } from './Dashboard';
import { LoginPage } from './components/LoginPage';
import { connectDashboardSocket, type ConversationUpdatedPayload } from './socket';
import { playNotificationSound, showBrowserNotification } from './notifications';

interface StoreSession {
  id: number;
  siteId: string;
  name: string;
  client: ApiClient;
  unread: number;
  expired: boolean;
}

// فروشگاه غیرفعال هم اتصال مستقل دارد؛ اطلاعاتش وارد صندوق فروشگاه فعال نمی‌شود.
function BackgroundStore({
  session,
  onUnreadChange,
  onMessage,
}: {
  session: StoreSession;
  onUnreadChange: (siteId: string) => void;
  onMessage: (siteId: string, payload: ConversationUpdatedPayload) => void;
}) {
  const { siteId, client } = session;
  useEffect(() => {
    const socket = connectDashboardSocket(() => client.getAccessToken(), {
      onConversationUpdated: (payload) => {
        onUnreadChange(siteId);
        if (payload.lastMessage?.senderType === 'visitor') onMessage(siteId, payload);
      },
      onTyping: () => {},
      onError: () => {},
    });
    socket.on('connect', () => onUnreadChange(siteId));
    return () => {
      socket.disconnect();
    };
  }, [siteId, client, onUnreadChange, onMessage]);
  return null;
}

export default function App() {
  const [sessions, setSessions] = useState<StoreSession[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [loginClient, setLoginClient] = useState<ApiClient | null>(() => new ApiClient());
  const [notice, setNotice] = useState<{
    siteId: string;
    conversationId: string;
    name: string;
    content: string;
  } | null>(null);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const nextId = useRef(0);
  const unreadRequests = useRef(
    new Map<string, { version: number; timer?: ReturnType<typeof setTimeout> }>(),
  );
  const refreshing = useRef(new Set<ApiClient>());

  const refreshUnread = useCallback((siteId: string) => {
    const previous = unreadRequests.current.get(siteId);
    if (previous?.timer) clearTimeout(previous.timer);
    const version = (previous?.version ?? 0) + 1;
    const request = {
      version,
      timer: setTimeout(async () => {
        const session = sessionsRef.current.find((s) => s.siteId === siteId && !s.expired);
        if (!session) return;
        try {
          const { unreadCount } = await session.client.getUnreadCount();
          if (unreadRequests.current.get(siteId)?.version !== version) return;
          setSessions((current) =>
            current.map((s) =>
              s.siteId === siteId && s.client === session.client
                ? { ...s, unread: unreadCount }
                : s,
            ),
          );
        } catch {
          // خطای گذرای شبکه شمارندهٔ قبلی را پاک نمی‌کند.
        }
      }, 200),
    };
    unreadRequests.current.set(siteId, request);
  }, []);

  const notifyMessage = useCallback((siteId: string, payload: ConversationUpdatedPayload) => {
    const session = sessionsRef.current.find((s) => s.siteId === siteId);
    if (!session || !payload.lastMessage) return;
    setNotice({
      siteId,
      conversationId: payload.conversationId,
      name: session.name,
      content: payload.lastMessage.content,
    });
    playNotificationSound();
    showBrowserNotification(`پیام جدید — ${session.name}`, payload.lastMessage.content);
  }, []);

  useEffect(() => {
    const requests = unreadRequests.current;
    return () => {
      for (const request of requests.values()) clearTimeout(request.timer);
    };
  }, []);

  useEffect(() => {
    const refresh = async () => {
      await Promise.all(
        sessionsRef.current
          .filter((s) => !s.expired)
          .map(async (session) => {
            if (refreshing.current.has(session.client)) return;
            refreshing.current.add(session.client);
            try {
              await session.client.refreshAccessToken();
              if (!session.client.getAccessToken()) {
                setSessions((current) =>
                  current.map((s) => (s.client === session.client ? { ...s, expired: true } : s)),
                );
              } else refreshUnread(session.siteId);
            } catch {
              // قطع اینترنت به معنی خروج از حساب نیست.
            } finally {
              refreshing.current.delete(session.client);
            }
          }),
      );
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = setInterval(
      () => {
        void refresh();
      },
      10 * 60 * 1000,
    );
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshUnread]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 12_000);
    return () => clearTimeout(timer);
  }, [notice]);

  const active = sessions.find((s) => s.siteId === activeSiteId) ?? sessions[0];
  const totalUnread = sessions.filter((s) => !s.expired).reduce((sum, s) => sum + s.unread, 0);
  const updateStoreName = useCallback(
    (siteId: string, name: string) =>
      setSessions((current) =>
        current.map((session) => (session.siteId === siteId ? { ...session, name } : session)),
      ),
    [],
  );
  const conversationOpened = useCallback(
    (siteId: string, conversationId: string) =>
      setNotice((current) =>
        current?.siteId === siteId && current.conversationId === conversationId ? null : current,
      ),
    [],
  );
  useEffect(() => {
    document.title = `${totalUnread ? `(${totalUnread}) ` : ''}${active?.name ?? 'ورود'} | میرا`;
  }, [active?.name, totalUnread]);

  async function finishLogin(client: ApiClient) {
    const site = await client.getSiteSettings();
    const previous = sessionsRef.current.find((s) => s.siteId === site.id);
    if (previous && previous.client !== client) previous.client.clearTokens();
    const session: StoreSession = {
      id: ++nextId.current,
      siteId: site.id,
      name: site.name,
      client,
      unread: 0,
      expired: false,
    };
    setSessions((current) => [...current.filter((s) => s.siteId !== site.id), session]);
    setActiveSiteId(site.id);
    setLoginClient(null);
    setNotice(null);
    refreshUnread(site.id);
  }

  function logout(siteId?: string) {
    const removed = sessionsRef.current.filter((s) => !siteId || s.siteId === siteId);
    for (const session of removed) session.client.clearTokens();
    const remaining = sessionsRef.current.filter((s) => !removed.includes(s));
    setSessions(remaining);
    setActiveSiteId(remaining[0]?.siteId ?? null);
    setNotice(null);
    if (!remaining.length) setLoginClient(new ApiClient());
  }

  if (loginClient) {
    return (
      <ApiProvider client={loginClient}>
        <LoginPage
          onLoggedIn={() => finishLogin(loginClient)}
          onCancel={
            sessions.length
              ? () => {
                  loginClient.clearTokens();
                  setLoginClient(null);
                }
              : undefined
          }
        />
        {sessions
          .filter((s) => !s.expired)
          .map((session) => (
            <BackgroundStore
              key={session.id}
              session={session}
              onUnreadChange={refreshUnread}
              onMessage={notifyMessage}
            />
          ))}
      </ApiProvider>
    );
  }
  if (!active) return null;
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50" dir="rtl">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
        <label htmlFor="store-switch" className="text-xs font-bold text-gray-600">
          فروشگاه فعال
        </label>
        <select
          id="store-switch"
          value={active.siteId}
          onChange={(event) => {
            setActiveSiteId(event.target.value);
            setNotice(null);
            refreshUnread(event.target.value);
          }}
          className="input-base max-w-xs p-2 text-sm font-bold"
        >
          {sessions.map((session) => (
            <option key={session.siteId} value={session.siteId}>
              {session.name}
              {session.expired ? ' — ورود مجدد' : ` — ${session.unread} خوانده‌نشده`}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setLoginClient(new ApiClient())}
          className="btn-primary px-3 py-2 text-xs"
        >
          افزودن فروشگاه
        </button>
        <div aria-label="پیام‌های فروشگاه‌ها" className="flex flex-1 flex-wrap gap-2">
          {sessions
            .filter((s) => s.unread > 0 && !s.expired)
            .map((session) => (
              <button
                key={session.siteId}
                type="button"
                onClick={() => {
                  setActiveSiteId(session.siteId);
                  setNotice(null);
                  refreshUnread(session.siteId);
                }}
                className="rounded-full bg-accent-50 px-3 py-1 text-xs font-bold text-accent-700"
              >
                {session.name}: {session.unread}
              </button>
            ))}
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="text-xs text-gray-500 hover:text-red-600"
        >
          خروج از همهٔ فروشگاه‌ها
        </button>
      </header>
      {sessions
        .filter((s) => s.siteId !== active.siteId && !s.expired)
        .map((session) => (
          <BackgroundStore
            key={session.id}
            session={session}
            onUnreadChange={refreshUnread}
            onMessage={notifyMessage}
          />
        ))}
      <div className="min-h-0 flex-1">
        {active.expired ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p>نشست {active.name} منقضی شده است؛ دوباره وارد شوید.</p>
            <button
              className="btn-primary px-4 py-2"
              onClick={() => setLoginClient(new ApiClient())}
            >
              ورود مجدد به فروشگاه
            </button>
            <button className="text-sm text-gray-500" onClick={() => logout(active.siteId)}>
              خروج از این فروشگاه
            </button>
          </div>
        ) : (
          <ApiProvider key={active.id} client={active.client}>
            <Dashboard
              onConversationOpened={conversationOpened}
              onStoreNameChange={updateStoreName}
              siteId={active.siteId}
              siteName={active.name}
              onLogout={() => logout(active.siteId)}
              onUnreadChange={refreshUnread}
              onMessage={notifyMessage}
            />
          </ApiProvider>
        )}
      </div>
      {notice && (
        <div
          role="status"
          className="fixed bottom-5 left-5 z-50 w-80 rounded-xl border border-primary-100 bg-white p-4 shadow-xl"
        >
          <button
            type="button"
            aria-label="بستن اعلان"
            className="float-left px-2 text-gray-400"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSiteId(notice.siteId);
              setNotice(null);
              refreshUnread(notice.siteId);
            }}
            className="block w-full text-right"
          >
            <strong className="text-sm text-primary-700">پیام جدید — {notice.name}</strong>
            <p className="mt-2 line-clamp-2 break-words text-sm text-gray-600">{notice.content}</p>
            <span className="mt-2 block text-xs text-primary-600">رفتن به فروشگاه</span>
          </button>
        </div>
      )}
    </div>
  );
}
