// صفحات بازدیدکنندگان در داشبورد (آنلاین / همه / پروفایل)

export interface VisitorListItemDto {
  id: string;
  visitorRef: string;
  name: string | null;
  email: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  isOnline: boolean;
  conversationCount: number;
  // آخرین صفحه‌ای که بازدیدکننده روی سایت دیده — برای فهمیدن «الان کجاست»
  currentPageUrl: string | null;
  currentPageTitle: string | null;
}

export interface VisitorConversationSummaryDto {
  id: string;
  status: string;
  department: string | null;
  priority: string;
  createdAt: string;
  resolvedAt: string | null;
  messageCount: number;
  csatScore: number | null;
}

export interface VisitorPageViewDto {
  url: string;
  title: string | null;
  visitedAt: string;
}

export interface VisitorProfileDto {
  id: string;
  visitorRef: string;
  name: string | null;
  email: string | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  isOnline: boolean;
  conversations: VisitorConversationSummaryDto[];
  pageViews: VisitorPageViewDto[];
}

export interface VisitorStatsDto {
  onlineNow: number;
  seenToday: number;
  totalVisitors: number;
}
