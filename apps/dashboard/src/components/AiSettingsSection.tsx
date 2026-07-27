import { useState } from 'react';
import type { SiteSettingsDto, UpdateSiteSettingsDto } from '@mira/shared-types';

interface AiSettingsSectionProps {
  settings: SiteSettingsDto;
  onSave: (patch: UpdateSiteSettingsDto) => Promise<void>;
}

// همه‌ی رفتار ربات از همین‌جا تنظیم می‌شود — بدون نیاز به تغییر env یا ری‌استارت سرویس
export function AiSettingsSection({ settings, onSave }: AiSettingsSectionProps) {
  const [enabled, setEnabled] = useState(settings.aiEnabled);
  const [botName, setBotName] = useState(settings.aiBotName);
  const [botAvatarUrl, setBotAvatarUrl] = useState(settings.aiBotAvatarUrl ?? '');
  const [systemPrompt, setSystemPrompt] = useState(settings.aiSystemPrompt ?? '');
  const [greeting, setGreeting] = useState(settings.aiGreetingMessage ?? '');
  const [handoff, setHandoff] = useState(settings.aiHandoffMessage ?? '');
  const [threshold, setThreshold] = useState(settings.aiConfidenceThreshold);
  const [temperature, setTemperature] = useState(settings.aiTemperature);
  const [maxTokens, setMaxTokens] = useState(settings.aiMaxTokens);
  const [maxReplies, setMaxReplies] = useState(settings.aiMaxRepliesPerConversation);
  const [onlyOutsideHours, setOnlyOutsideHours] = useState(
    settings.aiReplyOnlyOutsideBusinessHours,
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    setError(null);
    setSaving(true);
    try {
      await onSave({
        aiEnabled: enabled,
        aiBotName: botName.trim() || 'دستیار میرا',
        aiBotAvatarUrl: botAvatarUrl.trim() || null,
        aiSystemPrompt: systemPrompt.trim() || null,
        aiGreetingMessage: greeting.trim() || null,
        aiHandoffMessage: handoff.trim() || null,
        aiConfidenceThreshold: threshold,
        aiTemperature: temperature,
        aiMaxTokens: maxTokens,
        aiMaxRepliesPerConversation: maxReplies,
        aiReplyOnlyOutsideBusinessHours: onlyOutsideHours,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('ذخیره تنظیمات هوش مصنوعی با خطا مواجه شد');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-teal-200 bg-white">
      <div className="flex items-center justify-between border-b border-teal-100 bg-teal-50 px-4 py-3">
        <div className="flex items-center gap-3">
          {botAvatarUrl ? (
            <img src={botAvatarUrl} alt={botName} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-200 text-lg">
              🤖
            </div>
          )}
          <div>
            <div className="text-sm font-bold text-teal-900">{botName || 'دستیار میرا'}</div>
            <div className="text-[11px] text-teal-700">
              {enabled ? 'فعال — به مکالمات بدون اپراتور پاسخ می‌دهد' : 'غیرفعال'}
            </div>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-teal-900">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          فعال باشد
        </label>
      </div>

      <div className="space-y-5 p-4">
        <Group title="پروفایل ربات" hint="این نام و تصویر، هویت ربات در گفتگو با مشتری است.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نام ربات">
              <input
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="دستیار میرا"
                className="w-full rounded border border-gray-300 p-2 text-xs"
              />
            </Field>
            <Field label="آدرس تصویر ربات (URL)">
              <input
                value={botAvatarUrl}
                onChange={(e) => setBotAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded border border-gray-300 p-2 text-xs"
              />
            </Field>
          </div>
        </Group>

        <Group
          title="شخصیت و دستورالعمل"
          hint="مهم‌ترین تنظیم: به ربات می‌گوید با چه لحنی و با چه محدودیتی پاسخ دهد."
        >
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={4}
            placeholder="مثلاً: با لحن دوستانه و مثل یک فروشنده‌ی متخصص لوازم جانبی موبایل پاسخ بده. هیچ‌وقت قیمتی را حدس نزن."
            className="w-full rounded border border-gray-300 p-2 text-xs"
          />
        </Group>

        <Group title="پیام‌های آماده‌ی ربات">
          <div className="space-y-3">
            <Field label="پیام خوش‌آمدگویی (اختیاری)">
              <textarea
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                rows={2}
                placeholder="سلام! من دستیار هوشمند فروشگاه هستم، چطور می‌تونم کمکتون کنم؟"
                className="w-full rounded border border-gray-300 p-2 text-xs"
              />
            </Field>
            <Field label="پیام هنگام تحویل به اپراتور انسانی">
              <textarea
                value={handoff}
                onChange={(e) => setHandoff(e.target.value)}
                rows={2}
                placeholder="ممنون از پیامتون 🙏 برای پاسخ دقیق‌تر شما رو به یکی از همکارانم وصل می‌کنم."
                className="w-full rounded border border-gray-300 p-2 text-xs"
              />
            </Field>
          </div>
        </Group>

        <Group title="رفتار و دقت">
          <div className="space-y-4">
            <SliderField
              label="آستانه‌ی اطمینان"
              hint="اگر اطمینان ربات از این کمتر باشد، پاسخ نمی‌دهد و مکالمه را به اپراتور می‌سپارد. عدد بالاتر = محتاط‌تر."
              value={threshold}
              min={0}
              max={1}
              step={0.05}
              onChange={setThreshold}
              display={`${Math.round(threshold * 100)}٪`}
            />
            <SliderField
              label="خلاقیت پاسخ (Temperature)"
              hint="پایین = پاسخ دقیق و قابل‌پیش‌بینی (توصیه‌شده برای پشتیبانی). بالا = خلاقانه‌تر ولی کم‌دقت‌تر."
              value={temperature}
              min={0}
              max={1}
              step={0.05}
              onChange={setTemperature}
              display={temperature.toFixed(2)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="حداکثر طول پاسخ (توکن)" hint="سقف طول هر پاسخ ربات — کنترل هزینه.">
                <input
                  type="number"
                  min={100}
                  max={4000}
                  step={50}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="w-full rounded border border-gray-300 p-2 text-xs"
                />
              </Field>
              <Field
                label="حداکثر پاسخ در هر گفتگو"
                hint="بعد از این تعداد، ربات ساکت می‌شود تا اپراتور رسیدگی کند."
              >
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxReplies}
                  onChange={(e) => setMaxReplies(Number(e.target.value))}
                  className="w-full rounded border border-gray-300 p-2 text-xs"
                />
              </Field>
            </div>
            <label className="flex items-start gap-2 rounded bg-gray-50 p-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={onlyOutsideHours}
                onChange={(e) => setOnlyOutsideHours(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                فقط خارج از ساعت کاری پاسخ بده
                <span className="block text-[11px] text-gray-500">
                  در ساعت کاری، مکالمه‌ها مستقیم به اپراتورهای انسانی می‌رسد.
                </span>
              </span>
            </label>
          </div>
        </Group>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-teal-600 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات هوش مصنوعی'}
          </button>
          {saved && <span className="text-xs text-green-600">ذخیره شد ✓</span>}
        </div>
      </div>
    </section>
  );
}

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-bold text-gray-800">{title}</h3>
      {hint && <p className="mb-2 text-[11px] text-gray-500">{hint}</p>}
      {children}
    </div>
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
    <div>
      <label className="mb-1 block text-xs text-gray-600">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

function SliderField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs text-gray-600">{label}</label>
        <span className="rounded bg-teal-100 px-2 py-0.5 font-mono text-xs text-teal-800">
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-teal-600"
      />
      <p className="mt-1 text-[11px] text-gray-400">{hint}</p>
    </div>
  );
}
