import { useState } from 'react';
import {
  DEFAULT_AI_POLICY,
  type AiPolicy,
  type SiteSettingsDto,
  type UpdateSiteSettingsDto,
} from '@mira/shared-types';

interface AiSettingsSectionProps {
  settings: SiteSettingsDto;
  onSave: (patch: UpdateSiteSettingsDto) => Promise<void>;
}

const TABS = ['هویت و گفتگو', 'منابع و محصولات', 'گاردریل‌ها', 'مدل و هزینه'] as const;
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100';

export function AiSettingsSection({ settings, onSave }: AiSettingsSectionProps) {
  const [tab, setTab] = useState(0);
  const [draft, setDraft] = useState({
    name: settings.name,
    aiEnabled: settings.aiEnabled,
    aiBotName: settings.aiBotName,
    aiBotAvatarUrl: settings.aiBotAvatarUrl ?? '',
    aiSystemPrompt: settings.aiSystemPrompt ?? '',
    aiGreetingMessage: settings.aiGreetingMessage ?? '',
    aiHandoffMessage: settings.aiHandoffMessage ?? '',
    aiConfidenceThreshold: settings.aiConfidenceThreshold,
    aiTemperature: settings.aiTemperature,
    aiMaxTokens: settings.aiMaxTokens,
    aiMaxRepliesPerConversation: settings.aiMaxRepliesPerConversation,
    aiReplyOnlyOutsideBusinessHours: settings.aiReplyOnlyOutsideBusinessHours,
  });
  const [policy, setPolicy] = useState<AiPolicy>({ ...DEFAULT_AI_POLICY, ...settings.aiPolicy });
  const [quickReplies, setQuickReplies] = useState(policy.quickReplies.join('\n'));
  const [blockedTopics, setBlockedTopics] = useState(policy.blockedTopics.join('\n'));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const patch = (value: Partial<typeof draft>) => {
    setDraft((prev) => ({ ...prev, ...value }));
    setNotice('');
  };
  const set = (value: Partial<AiPolicy>) => {
    setPolicy((prev) => ({ ...prev, ...value }));
    setNotice('');
  };
  const lines = (value: string) => [
    ...new Set(
      value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError('');
    setNotice('');
    if ((policy.useProducts || policy.useWebsite) && !settings.wordpressSiteUrl) {
      setError('ابتدا آدرس HTTPS و کلید اتصال وردپرس را در بخش اتصال سایت ذخیره کنید.');
      return;
    }
    if (
      lines(quickReplies).length > 6 ||
      lines(quickReplies).some((line) => line.length > 100) ||
      lines(blockedTopics).length > 30 ||
      lines(blockedTopics).some((line) => line.length > 100)
    ) {
      setError('حداکثر ۶ شروع گفتگو و ۳۰ موضوع ممنوع، هرکدام تا ۱۰۰ نویسه مجاز است.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...draft,
        name: draft.name.trim(),
        aiBotName: draft.aiBotName.trim() || 'دستیار میرا',
        aiBotAvatarUrl: draft.aiBotAvatarUrl.trim() || null,
        aiPolicy: {
          ...policy,
          quickReplies: lines(quickReplies),
          blockedTopics: lines(blockedTopics),
        },
      });
      setNotice('تنظیمات ذخیره شد؛ در درخواست‌های بعدی اعمال می‌شود.');
    } catch {
      setError('ذخیره انجام نشد. اتصال و مقادیر ورودی را بررسی کنید.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label="مرکز هوش مصنوعی"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-400/20 text-2xl text-teal-300">
            ✦
          </span>
          <div>
            <h2 className="text-lg font-bold">مرکز هوش مصنوعی میرا</h2>
            <p className="mt-1 text-xs text-slate-300">یک دستیار آگاه به فروشگاه، با کنترل شما</p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs">
          <input
            type="checkbox"
            checked={draft.aiEnabled}
            onChange={(e) => patch({ aiEnabled: e.target.checked })}
            className="accent-teal-400"
          />
          {draft.aiEnabled ? 'دستیار فعال است' : 'دستیار غیرفعال است'}
        </label>
      </header>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <form onSubmit={save} className="min-w-0">
          <nav
            className="flex overflow-x-auto border-b border-slate-100 px-4"
            aria-label="بخش‌های تنظیمات هوش مصنوعی"
          >
            {TABS.map((title, index) => (
              <button
                key={title}
                type="button"
                aria-pressed={tab === index}
                onClick={() => setTab(index)}
                className={`shrink-0 border-b-2 px-3 py-4 text-xs font-bold ${tab === index ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500'}`}
              >
                {title}
              </button>
            ))}
          </nav>
          <div className="space-y-5 p-5 sm:p-6">
            {tab === 0 && (
              <>
                <Field
                  label="نام فروشگاه"
                  hint="هویت این سایت در ویجت و پاسخ‌های دستیار؛ اطلاعات فروشگاه‌های دیگر جدا می‌ماند."
                >
                  <input
                    className={inputClass}
                    value={draft.name}
                    required
                    maxLength={255}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="نام دستیار">
                    <input
                      className={inputClass}
                      value={draft.aiBotName}
                      maxLength={100}
                      onChange={(e) => patch({ aiBotName: e.target.value })}
                    />
                  </Field>
                  <Field label="تصویر دستیار (URL)">
                    <input
                      className={inputClass}
                      dir="ltr"
                      type="url"
                      value={draft.aiBotAvatarUrl}
                      maxLength={1024}
                      onChange={(e) => patch({ aiBotAvatarUrl: e.target.value })}
                    />
                  </Field>
                </div>
                <Field
                  label="شخصیت و لحن پاسخ"
                  hint="دستورهای ایمنی و الزام استفاده از منابع، مستقل از این متن اعمال می‌شوند."
                >
                  <textarea
                    className={inputClass}
                    rows={4}
                    maxLength={8000}
                    value={draft.aiSystemPrompt}
                    placeholder="با لحن صمیمی و دقیق به انتخاب محصول کمک کن…"
                    onChange={(e) => patch({ aiSystemPrompt: e.target.value })}
                  />
                </Field>
                <Field label="خوش‌آمدگویی">
                  <textarea
                    className={inputClass}
                    rows={2}
                    maxLength={2000}
                    value={draft.aiGreetingMessage}
                    placeholder="سلام! برای انتخاب محصول کنارتان هستم."
                    onChange={(e) => patch({ aiGreetingMessage: e.target.value })}
                  />
                </Field>
                <Field label="شروع‌های پیشنهادی گفتگو" hint="هر پیشنهاد در یک خط؛ حداکثر ۶ مورد.">
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={quickReplies}
                    onChange={(e) => {
                      setQuickReplies(e.target.value);
                      setNotice('');
                    }}
                  />
                </Field>
                <Field label="پیام تحویل به پشتیبان">
                  <textarea
                    className={inputClass}
                    rows={2}
                    maxLength={2000}
                    value={draft.aiHandoffMessage}
                    onChange={(e) => patch({ aiHandoffMessage: e.target.value })}
                    placeholder="برای پاسخ دقیق‌تر، گفتگو را به پشتیبان انسانی سپردم."
                  />
                </Field>
              </>
            )}
            {tab === 1 && (
              <>
                <p className="text-xs leading-6 text-slate-500">
                  مشخص کنید دستیار از کدام اطلاعات پاسخ بدهد. محتوای منابع فقط برای پاسخ‌گویی
                  استفاده می‌شود.
                </p>
                <Toggle
                  label="پایگاه دانش"
                  hint="اسناد آماده در بخش پایگاه دانش همین پنل جستجو می‌شوند."
                  checked={policy.useKnowledgeBase}
                  onChange={(v) => set({ useKnowledgeBase: v })}
                />
                <Toggle
                  label="صفحه‌ها و نوشته‌های عمومی سایت"
                  hint="جستجوی زنده در وردپرس؛ صفحه‌های خصوصی و رمزدار خوانده نمی‌شوند."
                  checked={policy.useWebsite}
                  onChange={(v) => set({ useWebsite: v })}
                />
                <Toggle
                  label="پیشنهاد محصول با کارت خرید"
                  hint="نام، قیمت، موجودی و لینک از ووکامرس خوانده می‌شود. خرید در صفحه محصول انجام می‌شود."
                  checked={policy.useProducts}
                  onChange={(v) => set({ useProducts: v })}
                />
                <div className="rounded-xl bg-blue-50 p-3 text-xs leading-6 text-blue-800">
                  منبع سایت: <b dir="ltr">{settings.wordpressSiteUrl || 'هنوز متصل نشده'}</b>
                  <br />
                  برای منابع زنده، افزونه به‌روز میرا و اتصال HTTPS عمومی لازم است. تنظیمات اتصال در
                  بخش وردپرس همین صفحه قرار دارد.
                </div>
                <Field
                  label="اطلاعات تأییدشده سایت و سرور"
                  hint="مثلاً خدمات فعال، محدودیت‌ها و راهنمای رفع مشکل. فقط اطلاعات قابل ارائه به مشتری را وارد کنید؛ کلید، رمز و اطلاعات خصوصی وارد نکنید."
                >
                  <textarea
                    className={inputClass}
                    rows={5}
                    maxLength={8000}
                    value={policy.serverContext}
                    onChange={(e) => set({ serverContext: e.target.value })}
                    placeholder="خدمات پشتیبانی ما…"
                  />
                </Field>
                <Field label="حداکثر کارت محصول در هر پاسخ">
                  <input
                    type="number"
                    className={inputClass}
                    min={1}
                    max={6}
                    value={policy.maxProducts}
                    onChange={(e) => set({ maxProducts: Number(e.target.value) })}
                  />
                </Field>
                <Toggle
                  label="نمایش منابع پاسخ"
                  hint="فقط منابعی نمایش داده می‌شوند که مدل انتخاب کرده و سرور تأیید کرده است."
                  checked={policy.showSources}
                  onChange={(v) => set({ showSources: v })}
                />
              </>
            )}
            {tab === 2 && (
              <>
                <div className="rounded-xl border border-teal-100 bg-teal-50 p-4 text-xs leading-7 text-teal-900">
                  <strong>محافظت‌های همیشگی</strong>
                  <p>
                    جداسازی اطلاعات سایت‌ها · لینک و کارت محصول معتبر · حذف الگوهای رایج اطلاعات
                    حساس پیش از ارسال به مدل · توقف پس از تحویل به انسان
                  </p>
                  <p className="text-teal-700">
                    این کنترل‌ها خطا را کاهش می‌دهند؛ صحت همه پاسخ‌ها و تشخیص همه اطلاعات حساس را
                    تضمین نمی‌کنند.
                  </p>
                </div>
                <Field
                  label="موضوع‌های ممنوع"
                  hint="هر عبارت در یک خط؛ تطبیق متنی باعث تحویل به پشتیبان می‌شود. حداکثر ۳۰ عبارت."
                >
                  <textarea
                    className={inputClass}
                    rows={4}
                    value={blockedTopics}
                    onChange={(e) => {
                      setBlockedTopics(e.target.value);
                      setNotice('');
                    }}
                    placeholder="مثلاً: اطلاعات حساب دیگران"
                  />
                </Field>
                <Range
                  label="حداقل ارتباط سند با پرسش"
                  value={policy.minSimilarity}
                  onChange={(v) => set({ minSimilarity: v })}
                  hint="شباهت برداری اسناد؛ عدد بالاتر، منابع نامرتبط بیشتری را حذف می‌کند."
                />
                <Range
                  label="حداقل اطمینان اعلام‌شده مدل"
                  value={draft.aiConfidenceThreshold}
                  onChange={(v) => patch({ aiConfidenceThreshold: v })}
                  hint="پاسخ ضعیف یا بدون منبع به پشتیبان تحویل می‌شود. این عدد احتمال اندازه‌گیری‌شده نیست."
                />
                <Field
                  label="حداکثر طول پیام ورودی AI (نویسه)"
                  hint="پیام طولانی‌تر برای پشتیبان باقی می‌ماند و به مدل ارسال نمی‌شود."
                >
                  <input
                    type="number"
                    className={inputClass}
                    min={100}
                    max={8000}
                    value={policy.maxInputChars}
                    onChange={(e) => set({ maxInputChars: Number(e.target.value) })}
                  />
                </Field>
              </>
            )}
            {tab === 3 && (
              <>
                <Field
                  label="شناسه مدل"
                  hint="خالی = مدل پیش‌فرض سرور. شناسه باید با ارائه‌دهنده تنظیم‌شده روی سرور سازگار باشد."
                >
                  <input
                    dir="ltr"
                    className={inputClass}
                    maxLength={120}
                    pattern="[a-zA-Z0-9._:/\-]*"
                    value={policy.model}
                    onChange={(e) => set({ model: e.target.value })}
                    placeholder="پیش‌فرض سرور"
                  />
                </Field>
                <p className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-500">
                  ارائه‌دهنده، آدرس API و کلید دسترسی در تنظیمات امن سرور نگه‌داری می‌شوند. تغییر
                  مدل نیاز به راه‌اندازی مجدد ندارد.
                </p>
                <Range
                  label="خلاقیت پاسخ"
                  value={draft.aiTemperature}
                  onChange={(v) => patch({ aiTemperature: v })}
                  hint="برای پشتیبانی، مقدار پایین‌تر پاسخ‌های باثبات‌تری می‌دهد."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="سقف توکن هر پاسخ">
                    <input
                      className={inputClass}
                      type="number"
                      min={100}
                      max={4000}
                      value={draft.aiMaxTokens}
                      onChange={(e) => patch({ aiMaxTokens: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="سقف پاسخ در هر گفتگو">
                    <input
                      className={inputClass}
                      type="number"
                      min={1}
                      max={100}
                      value={draft.aiMaxRepliesPerConversation}
                      onChange={(e) =>
                        patch({ aiMaxRepliesPerConversation: Number(e.target.value) })
                      }
                    />
                  </Field>
                </div>
                <Toggle
                  label="فقط خارج از ساعت کاری"
                  hint="ساعت کاری در همین صفحه تنظیم می‌شود؛ در ساعات کاری پشتیبان پاسخ می‌دهد."
                  checked={draft.aiReplyOnlyOutsideBusinessHours}
                  onChange={(v) => patch({ aiReplyOnlyOutsideBusinessHours: v })}
                />
              </>
            )}
            {error && (
              <p role="alert" className="text-xs leading-6 text-red-600">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="text-xs leading-6 text-teal-700">
                {notice}
              </p>
            )}
          </div>
          <footer className="flex items-center justify-between gap-3 border-t border-slate-100 p-5">
            <span className="text-[11px] text-slate-400">تغییرات پس از ذخیره اعمال می‌شوند</span>
            <button
              disabled={saving}
              className="rounded-xl bg-primary-600 px-5 py-3 text-xs font-bold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات AI'}
            </button>
          </footer>
        </form>
        <aside className="border-t border-slate-100 bg-slate-50 p-5 lg:border-r lg:border-t-0">
          <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
            <span>پیش‌نمایش ظاهر</span>
            <span className="rounded-full bg-white px-2 py-1 text-[10px]">نمونه نمایشی</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-l from-primary-600 to-teal-500 p-4 text-white">
              <span className="text-lg">✦</span>
              <div className="mt-2 font-bold">{draft.aiBotName || 'دستیار میرا'}</div>
              <div className="mt-1 text-[10px] text-white/80">دستیار هوشمند فروشگاه</div>
            </div>
            <div className="space-y-4 p-4 text-xs leading-6">
              <p className="text-slate-600">
                {draft.aiGreetingMessage || 'سلام! برای انتخاب محصول کنارتان هستم.'}
              </p>
              <div className="mr-6 rounded-xl bg-primary-50 p-3 text-primary-800">
                برای انتخاب محصول راهنمایی می‌خواهم.
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-teal-50 p-3 text-teal-800">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600 motion-reduce:animate-none" />
                در حال بررسی منابع فروشگاه
              </div>
              {policy.useProducts && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 grid h-16 place-items-center rounded-lg bg-slate-50 text-3xl text-slate-300">
                    ◇
                  </div>
                  <b>کارت محصول پیشنهادی</b>
                  <p className="text-[10px] text-slate-500">
                    قیمت و موجودی از فروشگاه خوانده می‌شود
                  </p>
                </div>
              )}
            </div>
          </div>
          <p className="mt-4 text-[11px] leading-6 text-slate-400">
            این پیش‌نمایش به مدل وصل نیست. برای آزمون پاسخ واقعی، ویجت سایت را باز کنید.
          </p>
        </aside>
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-2 block text-[11px] leading-6 text-slate-500">{hint}</span>}
    </label>
  );
}
function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
      <input
        className="mt-1 h-4 w-4 accent-teal-600"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <strong className="text-xs text-slate-800">{label}</strong>
        <span className="mt-1 block text-[11px] leading-6 text-slate-500">{hint}</span>
      </span>
    </label>
  );
}
function Range({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={`${label} · ${Math.round(value * 100)}٪`} hint={hint}>
      <input
        className="w-full accent-teal-600"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}
