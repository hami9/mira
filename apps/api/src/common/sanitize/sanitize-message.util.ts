import sanitizeHtml from 'sanitize-html';

// پیام‌های چت نیازی به HTML غنی ندارن؛ برای پیشگیری قطعی از XSS ذخیره‌شده،
// هر تگ/اسکریپت رو کاملاً حذف می‌کنیم و فقط متن خام باقی می‌مونه.
export function sanitizeMessageContent(rawContent: string): string {
  const withoutTags = sanitizeHtml(rawContent, {
    allowedTags: [],
    allowedAttributes: {},
  });
  return withoutTags.trim().slice(0, 8000);
}
