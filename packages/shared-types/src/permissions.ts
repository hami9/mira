// دسترسی‌های دقیق اپراتور — ادمین همیشه همه‌ی این‌ها را دارد (بدون نیاز به ست‌کردن جداگانه)،
// پس این پرچم‌ها فقط برای نقش «اپراتور» معنی دارند.
export const AGENT_PERMISSIONS = [
  'viewReports',
  'manageKnowledgeBase',
  'manageAutomation',
  'manageCannedResponses',
  'viewVisitors',
  'exportData',
  'resolveConversations',
] as const;

export type AgentPermission = (typeof AGENT_PERMISSIONS)[number];

export type AgentPermissionMap = Partial<Record<AgentPermission, boolean>>;

export const PERMISSION_LABELS: Record<AgentPermission, string> = {
  viewReports: 'مشاهده گزارش‌ها',
  manageKnowledgeBase: 'مدیریت پایگاه دانش',
  manageAutomation: 'مدیریت قوانین اتوماسیون',
  manageCannedResponses: 'مدیریت پاسخ‌های آماده',
  viewVisitors: 'مشاهده بازدیدکنندگان',
  exportData: 'خروجی گرفتن از داده‌ها',
  resolveConversations: 'بستن (حل) مکالمه',
};

// یک تابع مشترک بین api و داشبورد تا منطق «ادمین همه‌چیز را دارد» فقط یک‌جا تعریف شود
export function hasPermission(
  role: string,
  permissions: AgentPermissionMap | null | undefined,
  permission: AgentPermission,
): boolean {
  if (role === 'admin') return true;
  return permissions?.[permission] === true;
}
