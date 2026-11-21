// تشخیص ساده و ارزان مبتنی بر کلیدواژه — بدون نیاز به فراخوانی مدل زبانی، چون باید فوری
// (روی مسیر پیام زنده) اجرا شود. بین api (escalation فوریت) و worker (تشخیص درخواست اپراتور
// پیش از فراخوانی ربات RAG) مشترک است تا لیست کلمات در یک‌جا نگه‌داری شود.

const URGENT_KEYWORDS = [
  'فوری',
  'فوریه',
  'اورژانسی',
  'شکایت',
  'کلاهبرداری',
  'خیلی ناراضی',
  'به شدت ناراضی',
  'وکیل',
  'مراجع قانونی',
  'urgent',
  'emergency',
  'scam',
  'fraud',
  'lawsuit',
  'furious',
];

// مرز انتهای نقش لازم است تا «پشتیبانی» یا «انسانی بودن» به‌اشتباه درخواست اپراتور حساب نشود.
const HUMAN_ROLE =
  '(?:اپراتور انسانی|اپراتور|پشتیبان انسانی|پشتیبان واقعی|پشتیبان|کارشناس|انسان|آدم واقعی)(?![\\p{L}\\p{N}])';
const HUMAN_REQUEST_PATTERNS = [
  new RegExp(
    `^(?:لطفا |لطفاً )?${HUMAN_ROLE}(?: لطفا| لطفاً| می خواهم| می خوام| میخواهم| میخوام)?$`,
    'u',
  ),
  new RegExp(
    `(?:^| )(?:با|به) (?:یک |یه )?${HUMAN_ROLE}(?: \\p{L}+){0,2} (?:صحبت|گفتگو|گفت و گو|حرف|وصل|ارجاع)`,
    'u',
  ),
  new RegExp(`(?:^| )(?:صحبت|گفتگو|گفت و گو) با (?:یک |یه )?${HUMAN_ROLE}(?: لطفا| لطفاً)?$`, 'u'),
  new RegExp(`(?:وصل|ارجاع) (?:کن|کنید|کنین|بشم|شم) به (?:یک |یه )?${HUMAN_ROLE}`, 'u'),
  /^human(?: please)?$/,
  /\breal person\b/,
  /\b(?:talk|speak|chat)\b.{0,20}\b(?:human|agent|operator|someone)\b/,
];

// جداکردن فهرست کلیدواژه‌ی نوشته‌شده توسط کاربر (قوانین اتوماسیون).
// هم کامای انگلیسی و هم کامای فارسی «،» جداکننده‌اند — کاربر فارسی‌زبان به‌طور طبیعی «،»
// تایپ می‌کند و زمانی که فقط `,` پشتیبانی می‌شد، کل رشته یک کلیدواژه‌ی واحد حساب می‌شد و
// عملاً **هیچ قانونی هرگز match نمی‌کرد** (باگ واقعی ۲ — بخش ۶ AGENTS.md).
export function splitKeywords(rawValue: string): string[] {
  return rawValue
    .split(/[,،]/)
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
}

function containsAny(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

export function containsUrgentKeywords(text: string): boolean {
  return containsAny(text, URGENT_KEYWORDS);
}

export function containsHumanRequestKeywords(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\s\u200c]+/g, ' ')
    .replace(/[.!?؟،؛]+$/g, '')
    .trim();
  return HUMAN_REQUEST_PATTERNS.some((pattern) => pattern.test(normalized));
}
