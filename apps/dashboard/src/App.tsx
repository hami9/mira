import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  AgentRole,
  hasPermission,
  type AgentPermission,
  type AgentPermissionMap,
  type AgentProfileDto,
} from '@mira/shared-types';
import { apiClient, ConversationDto, ListConversationsParams } from './api';
import { connectDashboardSocket } from './socket';
import { decodeJwtPayload } from './jwt';
import { LoginPage } from './components/LoginPage';
import { Sidebar, type SidebarNavKey } from './components/Sidebar';
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
  const [myPermissions, setMyPermissions] = useState<AgentPermissionMap>({});
  // پروفایل خودِ اپراتور برای بلوک پایین سایدبار (نام/نقش/آواتار)
  const [myProfile, setMyProfile] = useState<AgentProfileDto | null>(null);
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

  // مجموع نخوانده‌ها هم عنوان تب مرورگر را می‌سازد و هم badge سایدبار را
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  useEffect(() => {
    document.title =
      totalUnread > 0 ? `(${totalUnread}) داشبورد اپراتور میرا` : 'داشبورد اپراتور میرا';
  }, [totalUnread]);

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
  }, [isAuthenticated]);

  function handleLoggedIn(): void {
    setIsAuthenticated(true);
    ensureNotificationPermission();
    const token = apiClient.getAccessToken();
    const payload = token ? decodeJwtPayload<{ role: string }>(token) : null;
    setIsAdmin(payload?.role === AgentRole.ADMIN);
    // دسترسی‌ها در توکن نیستند (تا لغوشان فوری اثر کند)، پس از سرور می‌گیریم.
    // این فقط برای نمایش/مخفی‌کردن منوهاست — تصمیم واقعی همیشه سمت سرور گرفته می‌شود.
    apiClient
      .getMyProfile()
      .then((profile) => {
        setMyPermissions(profile.permissions ?? {});
        setMyProfile(profile);
      })
      .catch(() => setMyPermissions({}));
  }

  function handleLogout(): void {
    // توکن‌ها فقط در حافظه‌اند؛ پاک‌کردنشان + ریست state کافی است
    // (قطع سوکت و تایمر refresh خودکار با cleanup افکت isAuthenticated انجام می‌شود)
    apiClient.clearTokens();
    setIsAuthenticated(false);
    setIsAdmin(false);
    setMyPermissions({});
    setMyProfile(null);
    setView('inbox');
    setViewedAgentId(null);
    setViewedVisitorId(null);
    setConversations([]);
    setSelectedConversation(null);
    setFilters({});
  }

  function can(permission: AgentPermission): boolean {
    return hasPermission(isAdmin ? 'admin' : 'agent', myPermissions, permission);
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

  // اگر view پروفایل بازدیدکننده بدون id باشد (حالت غیرمنتظره)، مثل قبل به صندوق ورودی برمی‌گردیم
  const effectiveView: DashboardView =
    view === 'visitor-profile' && !viewedVisitorId ? 'inbox' : view;

  function activeSidebarItem(): SidebarNavKey | 'profile' | null {
    switch (effectiveView) {
      case 'inbox':
      case 'settings':
      case 'reports':
      case 'agents':
      case 'visitors-online':
      case 'visitors-all':
        return effectiveView;
      case 'agent-profile':
        // اگر از فهرست اپراتورها باز شده «اپراتورها» فعال بماند؛ وگرنه یعنی پروفایل خودم
        return viewedAgentId ? 'agents' : 'profile';
      case 'visitor-profile':
        return visitorReturnView === 'visitors-all' ? 'visitors-all' : 'visitors-online';
      default:
        return null;
    }
  }

  function handleSidebarNavigate(key: SidebarNavKey): void {
    // پاک‌کردن idهای صفحات جزئیات تا حالت «بازگشت» آن‌ها با ناوبری مستقیم قاطی نشود
    setViewedAgentId(null);
    setViewedVisitorId(null);
    setView(key);
  }

  function renderPage() {
    if (effectiveView === 'settings') {
      return (
        <SettingsPage
          canManageSiteSettings={can('manageSiteSettings')}
          canManageKnowledgeBase={can('manageKnowledgeBase')}
          canManageAutomation={can('manageAutomation')}
          canManageCannedResponses={can('manageCannedResponses')}
          canManageWebhooks={can('manageWebhooks')}
        />
      );
    }

    if (effectiveView === 'reports') {
      return <ReportsPage />;
    }

    if (effectiveView === 'agents') {
      return (
        <AgentsPage
          onOpenProfile={(agentId) => {
            setViewedAgentId(agentId);
            setView('agent-profile');
          }}
        />
      );
    }

    if (effectiveView === 'agent-profile') {
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

    if (effectiveView === 'visitors-online') {
      return (
        <VisitorsOnlinePage
          onOpenVisitor={(visitorId) => {
            setViewedVisitorId(visitorId);
            setVisitorReturnView('visitors-online');
            setView('visitor-profile');
          }}
        />
      );
    }

    if (effectiveView === 'visitors-all') {
      return (
        <VisitorsAllPage
          onOpenVisitor={(visitorId) => {
            setViewedVisitorId(visitorId);
            setVisitorReturnView('visitors-all');
            setView('visitor-profile');
          }}
        />
      );
    }

    if (effectiveView === 'visitor-profile' && viewedVisitorId) {
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

    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        activeItem={activeSidebarItem()}
        unreadCount={totalUnread}
        showVisitors={can('viewVisitors')}
        showReports={can('viewReports')}
        showAgents={isAdmin}
        profileName={myProfile?.fullName ?? ''}
        profileRole={myProfile?.role ?? 'agent'}
        avatarUrl={myProfile?.avatarUrl ?? null}
        onNavigate={handleSidebarNavigate}
        onOpenMyProfile={() => {
          setViewedAgentId(null);
          setView('agent-profile');
        }}
        onLogout={handleLogout}
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {effectiveView === 'inbox' ? (
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
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-gray-400">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  className="h-12 w-12 text-gray-300"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 10.5h8M8 14h4m-6.7 5.3L3 21l1.2-3.6A8.5 8.5 0 1 1 7.6 20l-2.3-.7Z"
                  />
                </svg>
                یک مکالمه را برای مشاهده انتخاب کنید
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">{renderPage()}</div>
        )}
      </main>
    </div>
  );
}
