import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { AgentRole } from '@mira/shared-types';
import { apiClient, ConversationDto, ListConversationsParams } from './api';
import { connectDashboardSocket } from './socket';
import { decodeJwtPayload } from './jwt';
import { LoginPage } from './components/LoginPage';
import { ConversationList } from './components/ConversationList';
import { ChatWindow } from './components/ChatWindow';
import { VisitorInfoPanel } from './components/VisitorInfoPanel';
import { SettingsPage } from './components/SettingsPage';
import { ReportsPage } from './components/ReportsPage';
import { AgentsPage } from './components/AgentsPage';
import { AgentProfilePage } from './components/AgentProfilePage';
import { VisitorsOnlinePage } from './components/VisitorsOnlinePage';
import { VisitorsAllPage } from './components/VisitorsAllPage';
import { VisitorProfilePage } from './components/VisitorProfilePage';
import {
  ensureNotificationPermission,
  playNotificationSound,
  showBrowserNotification,
} from './notifications';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // هر ۱۰ دقیقه access token کوتاه‌عمر رو تازه می‌کنیم

type DashboardView =
  | 'inbox'
  | 'settings'
  | 'reports'
  | 'agents'
  | 'agent-profile'
  | 'visitors-online'
  | 'visitors-all'
  | 'visitor-profile';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<DashboardView>('inbox');
  // اپراتوری که پروفایلش باز است؛ null یعنی پروفایل خودِ کاربر وارد‌شده
  const [viewedAgentId, setViewedAgentId] = useState<string | null>(null);
  const [viewedVisitorId, setViewedVisitorId] = useState<string | null>(null);
  // برای این‌که «بازگشت» از پروفایل بازدیدکننده به همان فهرستی برگردد که ازش آمده
  const [visitorReturnView, setVisitorReturnView] = useState<DashboardView>('visitors-online');
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDto | null>(null);
  const [filters, setFilters] = useState<ListConversationsParams>({});
  const socketRef = useRef<Socket | null>(null);
  const selectedConversationIdRef = useRef<string | null>(null);
  const filtersRef = useRef<ListConversationsParams>({});

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversation?.id ?? null;
  }, [selectedConversation]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    document.title = totalUnread > 0 ? `(${totalUnread}) داشبورد اپراتور میرا` : 'داشبورد اپراتور میرا';
  }, [conversations]);

  const loadConversations = useCallback(async (currentFilters: ListConversationsParams) => {
    try {
      const list = await apiClient.listConversations(currentFilters);
      setConversations(list);
    } catch {
      // اگه توکن منقضی شده باشه، تلاش برای refresh در تایمر پایین انجام می‌شه
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    // debounce تا با هر ضربه‌ی کیبورد در جست‌وجو، درخواست جدا به سرور نزنیم
    const timeout = setTimeout(() => loadConversations(filters), 300);
    return () => clearTimeout(timeout);
  }, [isAuthenticated, filters, loadConversations]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const token = apiClient.getAccessToken();
    if (!token) return;

    const socket = connectDashboardSocket(token, {
      onConversationUpdated: (payload) => {
        loadConversations(filtersRef.current);
        // اگه پیام تازه از بازدیدکننده است و اپراتور همین لحظه اون مکالمه رو باز نکرده، اعلان بده
        if (payload.lastMessage?.senderType === 'visitor') {
          if (selectedConversationIdRef.current !== payload.conversationId) {
            playNotificationSound();
            showBrowserNotification('پیام جدید میرا', payload.lastMessage.content);
          }
        }
      },
      onTyping: () => {},
      onError: (message) => console.warn('[میرا]', message),
    });
    socketRef.current = socket;

    const refreshTimer = setInterval(async () => {
      await apiClient.refreshAccessToken();
    }, REFRESH_INTERVAL_MS);

    return () => {
      socket.disconnect();
      clearInterval(refreshTimer);
    };
    // filters عمداً در dependency نیست: نمی‌خوایم با هر تغییر فیلتر، سوکت قطع/وصل شه
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  function handleLoggedIn(): void {
    setIsAuthenticated(true);
    ensureNotificationPermission();
    const token = apiClient.getAccessToken();
    const payload = token ? decodeJwtPayload<{ role: string }>(token) : null;
    setIsAdmin(payload?.role === AgentRole.ADMIN);
  }

  function markConversationSeenLocally(conversationId: string): void {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
    );
    setSelectedConversation((prev) =>
      prev && prev.id === conversationId ? { ...prev, unreadCount: 0 } : prev,
    );
  }

  async function handleSelectConversation(conversation: ConversationDto): Promise<void> {
    setSelectedConversation(conversation);
    // بلافاصله در UI به‌عنوان خوانده‌شده نشون بده؛ سرور هم با ConversationJoin سوکت و این درخواست هماهنگ می‌شه
    markConversationSeenLocally(conversation.id);
    apiClient.markConversationRead(conversation.id).catch(() => {});
    if (!conversation.assignedAgentId) {
      try {
        const updated = await apiClient.assignConversation(conversation.id);
        setSelectedConversation((prev) =>
          prev && prev.id === updated.id ? { ...updated, unreadCount: 0 } : prev,
        );
        setConversations((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...updated, unreadCount: 0 } : c)),
        );
      } catch {
        // اختصاص خودکار مهم نیست که با شکست مواجه شه؛ اپراتور همچنان می‌تونه مکالمه رو ببینه
      }
    }
  }

  function handleConversationUpdated(updated: ConversationDto): void {
    setSelectedConversation(updated);
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  if (!isAuthenticated) {
    return <LoginPage onLoggedIn={handleLoggedIn} />;
  }

  if (view === 'settings') {
    return <SettingsPage onClose={() => setView('inbox')} isAdmin={isAdmin} />;
  }

  if (view === 'reports') {
    return <ReportsPage onClose={() => setView('inbox')} />;
  }

  if (view === 'agents') {
    return (
      <AgentsPage
        onClose={() => setView('inbox')}
        onOpenProfile={(agentId) => {
          setViewedAgentId(agentId);
          setView('agent-profile');
        }}
      />
    );
  }

  if (view === 'agent-profile') {
    return (
      <AgentProfilePage
        agentId={viewedAgentId}
        onClose={() => {
          // اگر از فهرست اپراتورها آمده بودیم به همان‌جا برگردیم، وگرنه به صندوق ورودی
          setView(viewedAgentId ? 'agents' : 'inbox');
          setViewedAgentId(null);
        }}
      />
    );
  }

  if (view === 'visitors-online') {
    return (
      <VisitorsOnlinePage
        onClose={() => setView('inbox')}
        onGoToAll={() => setView('visitors-all')}
        onOpenVisitor={(visitorId) => {
          setViewedVisitorId(visitorId);
          setVisitorReturnView('visitors-online');
          setView('visitor-profile');
        }}
      />
    );
  }

  if (view === 'visitors-all') {
    return (
      <VisitorsAllPage
        onClose={() => setView('inbox')}
        onGoToOnline={() => setView('visitors-online')}
        onOpenVisitor={(visitorId) => {
          setViewedVisitorId(visitorId);
          setVisitorReturnView('visitors-all');
          setView('visitor-profile');
        }}
      />
    );
  }

  if (view === 'visitor-profile' && viewedVisitorId) {
    return (
      <VisitorProfilePage
        visitorId={viewedVisitorId}
        onClose={() => {
          setView(visitorReturnView);
          setViewedVisitorId(null);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white p-3 text-sm font-bold text-gray-700">
        داشبورد اپراتور میرا
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('visitors-online')}
            className="text-xs font-normal text-blue-600"
          >
            بازدیدکنندگان
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setView('agents')}
                className="text-xs font-normal text-blue-600"
              >
                اپراتورها
              </button>
              <button
                onClick={() => setView('reports')}
                className="text-xs font-normal text-blue-600"
              >
                گزارش‌ها
              </button>
            </>
          )}
          <button
            onClick={() => {
              setViewedAgentId(null);
              setView('agent-profile');
            }}
            className="text-xs font-normal text-blue-600"
          >
            پروفایل من
          </button>
          {/* تنظیمات برای همه‌ی اپراتورها بازه — غیر-ادمین فقط 2FA حساب خودش رو می‌بینه */}
          <button
            onClick={() => setView('settings')}
            className="text-xs font-normal text-blue-600"
          >
            تنظیمات
          </button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation?.id ?? null}
          filters={filters}
          onFiltersChange={setFilters}
          onSelect={handleSelectConversation}
        />
        {selectedConversation ? (
          <>
            <ChatWindow
              conversation={selectedConversation}
              socket={socketRef.current}
              onConversationUpdated={handleConversationUpdated}
              onMessageSeen={markConversationSeenLocally}
            />
            <VisitorInfoPanel conversationId={selectedConversation.id} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            یک مکالمه را برای مشاهده انتخاب کنید
          </div>
        )}
      </div>
    </div>
  );
}
