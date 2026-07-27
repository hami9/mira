import type { BusinessHours, TriggerMessageConfig } from './business-hours';

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  // وقتی 2FA فعاله، این دوتا خالی می‌مونن و به‌جاش twoFactorRequired/twoFactorToken پر می‌شن
  accessToken?: string;
  refreshToken?: string;
  twoFactorRequired?: boolean;
  twoFactorToken?: string;
}

export interface RefreshRequestDto {
  refreshToken: string;
}

export interface RefreshResponseDto {
  accessToken: string;
}

export interface WidgetSessionRequestDto {
  widgetKey: string;
  // شناسه ناشناس و غیرحساس بازدیدکننده که ویجت در localStorage نگه می‌داره (نه توکن، نه PII)
  visitorRef?: string;
  name?: string;
  email?: string;
}

export interface WidgetSessionResponseDto {
  visitorToken: string;
  visitorRef: string;
  siteId: string;
  activeConversationId: string | null;
  // مکالمه‌ی حل‌شده‌ای که هنوز CSAT ثبت نشده (برای نمایش دوباره‌ی پرامپت امتیازدهی بعد از رفرش صفحه)
  pendingRatingConversationId: string | null;
  triggerMessage: TriggerMessageConfig | null;
}

export interface StartConversationResponseDto {
  conversationId: string;
  status: string;
}

export interface SubmitCsatDto {
  score: number; // ۱ تا ۵
  comment?: string;
}

export interface SiteSettingsDto {
  id: string;
  name: string;
  widgetKey: string;
  allowedDomains: string[];
  appearance: Record<string, unknown>;
  businessHours: BusinessHours | null;
  offlineMessage: string | null;
  triggerMessage: TriggerMessageConfig;
  // آدرس سایت وردپرس و کلیدی که میرا برای صدا زدن REST endpoint سفارشی وردپرس استفاده می‌کنه
  wordpressSiteUrl: string | null;
  wordpressApiKey: string | null;
  // تنظیمات ربات پاسخ‌گوی هوش مصنوعی (فاز ۴)
  aiEnabled: boolean;
  aiSystemPrompt: string | null;
  aiConfidenceThreshold: number;
  // پروفایل و تنظیمات گسترده‌ی ربات (قابل تنظیم کامل از داشبورد)
  aiBotName: string;
  aiBotAvatarUrl: string | null;
  aiGreetingMessage: string | null;
  aiHandoffMessage: string | null;
  aiTemperature: number;
  aiMaxTokens: number;
  aiMaxRepliesPerConversation: number;
  aiReplyOnlyOutsideBusinessHours: boolean;
}

export interface UpdateSiteSettingsDto {
  name?: string;
  allowedDomains?: string[];
  appearance?: Record<string, unknown>;
  businessHours?: BusinessHours | null;
  offlineMessage?: string | null;
  triggerMessage?: TriggerMessageConfig;
  wordpressSiteUrl?: string | null;
  wordpressApiKey?: string | null;
  aiEnabled?: boolean;
  aiSystemPrompt?: string | null;
  aiConfidenceThreshold?: number;
  aiBotName?: string;
  aiBotAvatarUrl?: string | null;
  aiGreetingMessage?: string | null;
  aiHandoffMessage?: string | null;
  aiTemperature?: number;
  aiMaxTokens?: number;
  aiMaxRepliesPerConversation?: number;
  aiReplyOnlyOutsideBusinessHours?: boolean;
}
