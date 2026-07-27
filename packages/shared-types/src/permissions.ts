// دسترسی‌های دقیق اپراتور — ادمین همیشه همه‌ی این‌ها را دارد (بدون نیاز به ست‌کردن جداگانه)،
// پس این پرچم‌ها فقط برای نقش «اپراتور» معنی دارند.
//
// نکته‌ی امنیتی: «مدیریت اپراتورها» عمداً یک permission نیست و برای همیشه فقط دست ادمین است.
// اگر قابل‌واگذاری بود، یک اپراتور می‌توانست دسترسی‌های خودش را بالا ببرد (privilege escalation).
export const AGENT_PERMISSIONS = [
  'viewReports',
  'exportData',
  'manageKnowledgeBase',
  'manageAutomation',
  'manageCannedResponses',
  'manageWebhooks',
  'manageSiteSettings',
  'viewVisitors',
  'deleteVisitorData',
  'resolveConversations',
] as const;

export type AgentPermission = (typeof AGENT_PERMISSIONS)[number];

export type AgentPermissionMap = Partial<Record<AgentPermission, boolean>>;

export const PERMISSION_LABELS: Record<AgentPermission, string> = {
  viewReports: 'مشاهده گزارش‌ها',
  exportData: 'خروجی گرفتن از گزارش‌ها (CSV)',
  manageKnowledgeBase: 'مدیریت پایگاه دانش',
  manageAutomation: 'مدیریت قوانین اتوماسیون',
  manageCannedResponses: 'مدیریت پاسخ‌های آماده',
  manageWebhooks: 'مدیریت وب‌هوک و کلید API',
  manageSiteSettings: 'تغییر تنظیمات سایت و هوش مصنوعی',
  viewVisitors: 'مشاهده بازدیدکنندگان',
  deleteVisitorData: 'حذف داده‌ی بازدیدکننده (حریم خصوصی)',
  resolveConversations: 'بستن (حل) مکالمه',
};

// توضیح کوتاه هر دسترسی برای این‌که ادمین بداند دقیقاً چه چیزی را باز می‌کند
export const PERMISSION_DESCRIPTIONS: Record<AgentPermission, string> = {
  viewReports: 'صفحه‌ی گزارش‌ها: آمار مکالمات، زمان پاسخ، CSAT و عملکرد اپراتورها',
  exportData: 'دانلود فایل CSV عملکرد اپراتورها',
  manageKnowledgeBase: 'افزودن و حذف اسناد پایگاه دانش که ربات از آن‌ها پاسخ می‌دهد',
  manageAutomation: 'ساخت و ویرایش قوانین مسیریابی خودکار مکالمات',
  manageCannedResponses: 'ساخت و ویرایش پاسخ‌های آماده‌ی مشترک تیم',
  manageWebhooks: 'ساخت وب‌هوک و کلید API عمومی برای اتصال سرویس‌های بیرونی',
  manageSiteSettings: 'ساعت کاری، ظاهر ویجت، اتصال ووکامرس و تنظیمات ربات هوش مصنوعی',
  viewVisitors: 'صفحات بازدیدکنندگان آنلاین، فهرست کامل و پروفایل تک‌بازدیدکننده',
  deleteVisitorData: 'حذف کامل و برگشت‌ناپذیر داده‌های یک بازدیدکننده',
  resolveConversations: 'علامت‌زدن مکالمه به‌عنوان حل‌شده',
};

// گروه‌بندی فقط برای نمایش مرتب‌تر در UI است و روی منطق دسترسی اثری ندارد
export const PERMISSION_GROUPS: { title: string; permissions: AgentPermission[] }[] = [
  {
    title: 'گفتگو و بازدیدکنندگان',
    permissions: ['resolveConversations', 'viewVisitors', 'deleteVisitorData'],
  },
  { title: 'گزارش‌ها', permissions: ['viewReports', 'exportData'] },
  {
    title: 'محتوا و اتوماسیون',
    permissions: ['manageCannedResponses', 'manageKnowledgeBase', 'manageAutomation'],
  },
  { title: 'تنظیمات و یکپارچه‌سازی', permissions: ['manageSiteSettings', 'manageWebhooks'] },
];

// الگوهای آماده تا ادمین مجبور نباشد هر بار ده تیک را دستی بزند
export const PERMISSION_PRESETS: {
  name: string;
  description: string;
  permissions: AgentPermission[];
}[] = [
  {
    name: 'اپراتور پایه',
    description: 'فقط پاسخ‌دادن و بستن مکالمه',
    permissions: ['resolveConversations'],
  },
  {
    name: 'اپراتور ارشد',
    description: 'مکالمات، بازدیدکنندگان، پاسخ آماده و گزارش‌ها',
    permissions: [
      'resolveConversations',
      'viewVisitors',
      'manageCannedResponses',
      'viewReports',
      'exportData',
    ],
  },
  {
    name: 'سرپرست تیم',
    description: 'همه‌چیز به‌جز تنظیمات سایت و مدیریت اپراتورها',
    permissions: [
      'resolveConversations',
      'viewVisitors',
      'deleteVisitorData',
      'viewReports',
      'exportData',
      'manageCannedResponses',
      'manageKnowledgeBase',
      'manageAutomation',
    ],
  },
];

// یک تابع مشترک بین api و داشبورد تا منطق «ادمین همه‌چیز را دارد» فقط یک‌جا تعریف شود
export function hasPermission(
  role: string,
  permissions: AgentPermissionMap | null | undefined,
  permission: AgentPermission,
): boolean {
  if (role === 'admin') return true;
  return permissions?.[permission] === true;
}
