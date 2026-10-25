import { useEffect, useState } from 'react';
import {
  WEEKDAYS,
  type BusinessHours,
  type CannedResponseDto,
  type SiteSettingsDto,
  type TriggerMessageConfig,
  type UpdateSiteSettingsDto,
  type Weekday,
} from '@mira/shared-types';
import { useApiClient } from '../api-context';
import { AutomationRulesSection } from './AutomationRulesSection';
import { WebhooksSection } from './WebhooksSection';
import { TwoFactorSection } from './TwoFactorSection';
import { AiSettingsSection } from './AiSettingsSection';
import { AiBillingSection } from './AiBillingSection';
import { SystemSection } from './SystemSection';
import { InstallSection } from './InstallSection';
import { KnowledgeSection } from './KnowledgeSection';

interface SettingsPageProps {
  onSiteNameChange?: (name: string) => void;
  isAdmin?: boolean;
  canManageSiteSettings: boolean;
  canManageKnowledgeBase: boolean;
  canManageAutomation: boolean;
  canManageCannedResponses: boolean;
  canManageWebhooks: boolean;
}

const WEEKDAY_LABELS: Record<Weekday, string> = {
  sat: 'شنبه',
  sun: 'یکشنبه',
  mon: 'دوشنبه',
  tue: 'سه‌شنبه',
  wed: 'چهارشنبه',
  thu: 'پنجشنبه',
  fri: 'جمعه',
};

function defaultBusinessHours(): BusinessHours {
  const days = {} as BusinessHours['days'];
  for (const day of WEEKDAYS) {
    days[day] = { enabled: day !== 'fri', start: '09:00', end: '18:00' };
  }
  return { days };
}

export function SettingsPage({
  onSiteNameChange,
  isAdmin = false,
  canManageSiteSettings,
  canManageKnowledgeBase,
  canManageAutomation,
  canManageCannedResponses,
  canManageWebhooks,
}: SettingsPageProps) {
  const apiClient = useApiClient();
  const [tab, setTab] = useState('ai');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const tabs = [
    { key: 'ai', label: 'هوش مصنوعی', allowed: canManageSiteSettings },
    { key: 'knowledge', label: 'پایگاه دانش', allowed: canManageKnowledgeBase },
    { key: 'install', label: 'نصب و اتصال', allowed: canManageSiteSettings },
    {
      key: 'operations',
      label: 'عملیات',
      allowed:
        canManageSiteSettings ||
        canManageAutomation ||
        canManageCannedResponses ||
        canManageWebhooks,
    },
    { key: 'billing', label: 'هزینه و مصرف', allowed: isAdmin },
    { key: 'system', label: 'سیستم', allowed: isAdmin },
    { key: 'account', label: 'امنیت حساب', allowed: true },
  ].filter((item) => item.allowed);
  const activeTab = tabs.some((item) => item.key === tab) ? tab : tabs[0].key;
  // هر بخش تنظیمات دسترسی خودش را دارد؛ اگر اپراتور هیچ‌کدام را نداشته باشد فقط 2FA خودش را می‌بیند
  const hasAnySettingsAccess =
    canManageSiteSettings ||
    canManageKnowledgeBase ||
    canManageAutomation ||
    canManageCannedResponses ||
    canManageWebhooks;
  const [settings, setSettings] = useState<SiteSettingsDto | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHours>(defaultBusinessHours());
  const [offlineMessage, setOfflineMessage] = useState('');
  const [triggerMessage, setTriggerMessage] = useState<TriggerMessageConfig>({
    enabled: false,
    delaySeconds: 30,
    text: '',
  });
  const [wordpressSiteUrl, setWordpressSiteUrl] = useState('');
  const [wordpressApiKey, setWordpressApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const [cannedResponses, setCannedResponses] = useState<CannedResponseDto[]>([]);
  const [newShortcut, setNewShortcut] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  useEffect(() => {
    // اپراتور غیر-ادمین فقط بخش 2FA خودش رو می‌بینه، پس تنظیمات سایت رو هم اصلاً نمی‌خونیم
    if (!hasAnySettingsAccess) return;
    setLoadError('');
    apiClient
      .getSiteSettings()
      .then((data) => {
        setSettings(data);
        setBusinessHours(data.businessHours ?? defaultBusinessHours());
        setOfflineMessage(data.offlineMessage ?? '');
        setTriggerMessage(data.triggerMessage);
        setWordpressSiteUrl(data.wordpressSiteUrl ?? '');
        setWordpressApiKey(data.wordpressApiKey ?? '');
      })
      .catch(() => setLoadError('دریافت تنظیمات ناموفق بود.'));
    if (canManageCannedResponses)
      apiClient
        .listCannedResponses()
        .then(setCannedResponses)
        .catch(() => {});
  }, [hasAnySettingsAccess, loadAttempt, apiClient, canManageCannedResponses]);

  async function handleSave(): Promise<void> {
    setSaving(true);
    setSaveError('');
    try {
      const updated = await apiClient.updateSiteSettings({
        businessHours,
        offlineMessage,
        triggerMessage,
        wordpressSiteUrl: wordpressSiteUrl.trim() || null,
        ...(wordpressApiKey.trim() ? { wordpressApiKey: wordpressApiKey.trim() } : {}),
      });
      setSettings(updated);
      setWordpressApiKey('');
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } catch {
      setSaveError('ذخیره تنظیمات ناموفق بود؛ دوباره تلاش کنید.');
    } finally {
      setSaving(false);
    }
  }

  // بخش هوش مصنوعی state خودش رو داره؛ بعد از ذخیره، نسخه‌ی سرور رو دوباره می‌خونیم تا
  // settings والد هم با مقادیر واقعی ذخیره‌شده همگام بمونه
  async function handleSaveAiSettings(patch: UpdateSiteSettingsDto): Promise<void> {
    const updated = await apiClient.updateSiteSettings(patch);
    setSettings(updated);
    onSiteNameChange?.(updated.name);
  }

  function updateDay(day: Weekday, patch: Partial<BusinessHours['days'][Weekday]>): void {
    setBusinessHours((prev) => ({
      days: { ...prev.days, [day]: { ...prev.days[day], ...patch } },
    }));
  }

  async function handleAddCannedResponse(): Promise<void> {
    if (!newShortcut.trim() || !newTitle.trim() || !newContent.trim()) return;
    const created = await apiClient.createCannedResponse({
      shortcut: newShortcut.trim(),
      title: newTitle.trim(),
      content: newContent.trim(),
    });
    setCannedResponses((prev) => [...prev, created]);
    setNewShortcut('');
    setNewTitle('');
    setNewContent('');
  }

  async function handleDeleteCannedResponse(id: string): Promise<void> {
    await apiClient.deleteCannedResponse(id);
    setCannedResponses((prev) => prev.filter((response) => response.id !== id));
  }

  // اپراتوری که هیچ دسترسی تنظیماتی ندارد، فقط بخش امنیتی حساب خودش را می‌بیند
  if (!hasAnySettingsAccess) {
    return (
      <div className="mx-auto w-full max-w-6xl overflow-y-auto p-4 sm:p-6">
        <h1 className="mb-4 text-lg font-bold text-gray-800">تنظیمات حساب من</h1>
        <TwoFactorSection />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 text-sm text-gray-400">
        {loadError || 'در حال بارگذاری تنظیمات...'}
        {loadError && (
          <button
            onClick={() => setLoadAttempt((value) => value + 1)}
            className="mr-3 text-primary-600"
          >
            تلاش دوباره
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl overflow-y-auto p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight text-gray-800">تنظیمات {settings.name}</h1>
        <p className="mt-1 text-xs text-gray-400">
          دستیار، منابع و عملیات فروشگاه را از یکجا مدیریت کنید.
        </p>
      </div>
      <nav
        aria-label="بخش‌های تنظیمات"
        className="sticky top-0 z-10 mb-6 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
      >
        {tabs.map((item) => (
          <button
            type="button"
            key={item.key}
            onClick={() => setTab(item.key)}
            aria-pressed={activeTab === item.key}
            className={`shrink-0 rounded-lg px-4 py-2.5 text-xs transition-colors ${activeTab === item.key ? 'bg-primary-50 font-bold text-primary-700' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {saveError && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-600">
          {saveError}
        </p>
      )}

      {activeTab === 'account' && <TwoFactorSection />}

      {activeTab === 'install' && canManageSiteSettings && (
        <InstallSection settings={settings} onSave={handleSaveAiSettings} />
      )}
      {activeTab === 'billing' && isAdmin && <AiBillingSection />}
      {activeTab === 'system' && isAdmin && <SystemSection />}

      {activeTab === 'operations' && canManageSiteSettings && (
        <section className="mb-6 rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-700">ساعت کاری</h2>
          {WEEKDAYS.map((day) => (
            <div key={day} className="mb-2 flex items-center gap-2 text-xs">
              <label className="flex w-24 items-center gap-1">
                <input
                  type="checkbox"
                  checked={businessHours.days[day]?.enabled ?? false}
                  onChange={(e) => updateDay(day, { enabled: e.target.checked })}
                />
                {WEEKDAY_LABELS[day]}
              </label>
              <input
                type="time"
                value={businessHours.days[day]?.start ?? '09:00'}
                onChange={(e) => updateDay(day, { start: e.target.value })}
                className="rounded border border-gray-300 p-1"
              />
              <span>تا</span>
              <input
                type="time"
                value={businessHours.days[day]?.end ?? '18:00'}
                onChange={(e) => updateDay(day, { end: e.target.value })}
                className="rounded border border-gray-300 p-1"
              />
            </div>
          ))}

          <h2 className="mb-2 mt-4 text-sm font-bold text-gray-700">پیام خارج از ساعت کاری</h2>
          <textarea
            value={offlineMessage}
            onChange={(e) => setOfflineMessage(e.target.value)}
            placeholder="مثلاً: ما اکنون آفلاین هستیم، پیام شما را در اولین فرصت پاسخ می‌دهیم."
            className="w-full rounded border border-gray-300 p-2 text-xs"
            rows={2}
          />

          <h2 className="mb-2 mt-4 text-sm font-bold text-gray-700">پیام محرک (Trigger Message)</h2>
          <label className="mb-2 flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={triggerMessage.enabled}
              onChange={(e) => setTriggerMessage({ ...triggerMessage, enabled: e.target.checked })}
            />
            فعال باشد
          </label>
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span>نمایش بعد از</span>
            <input
              type="number"
              min={1}
              max={600}
              value={triggerMessage.delaySeconds}
              onChange={(e) =>
                setTriggerMessage({ ...triggerMessage, delaySeconds: Number(e.target.value) })
              }
              className="w-20 rounded border border-gray-300 p-1"
            />
            <span>ثانیه</span>
          </div>
          <textarea
            value={triggerMessage.text}
            onChange={(e) => setTriggerMessage({ ...triggerMessage, text: e.target.value })}
            placeholder="مثلاً: سلام! سوالی دارید؟ اینجا هستیم :)"
            className="w-full rounded border border-gray-300 p-2 text-xs"
            rows={2}
          />

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 rounded-lg bg-primary-600 transition-colors hover:bg-primary-700 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
          </button>
          {savedNotice && <span className="mr-3 text-xs text-green-600">ذخیره شد ✓</span>}
        </section>
      )}

      {activeTab === 'install' && canManageSiteSettings && (
        <section className="mb-6 rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-700">اتصال وردپرس/ووکامرس</h2>
          <p className="mb-3 text-gray-500">
            افزونه‌ی میرا را روی سایت وردپرس نصب کن، از صفحه تنظیمات افزونه یک «کلید API» بساز، و
            همون کلید رو اینجا هم وارد کن تا داشبورد بتونه اطلاعات سفارش مشتری رو کنار گفتگو نشون
            بده.
          </p>
          <div className="mb-2">
            <label className="mb-1 block text-gray-600">آدرس سایت وردپرس</label>
            <input
              value={wordpressSiteUrl}
              onChange={(e) => setWordpressSiteUrl(e.target.value)}
              placeholder="https://shop.example.com"
              className="w-full rounded border border-gray-300 p-1.5"
            />
          </div>
          <div className="mb-2">
            <label className="mb-1 block text-gray-600">کلید API (مشترک با افزونه وردپرس)</label>
            <input
              value={wordpressApiKey}
              type="password"
              onChange={(e) => setWordpressApiKey(e.target.value)}
              placeholder={
                settings.wordpressApiKeyConfigured
                  ? 'کلید ذخیره شده؛ برای تغییر، کلید جدید وارد کنید'
                  : 'کلید ساخته‌شده در افزونه وردپرس'
              }
              className="w-full rounded border border-gray-300 p-1.5"
            />
          </div>
          <div className="rounded bg-gray-50 p-2 text-gray-500">
            widgetKey این سایت برای وارد کردن در افزونه وردپرس:{' '}
            <code className="font-mono text-gray-800">{settings.widgetKey}</code>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-3 rounded-lg bg-primary-600 transition-colors hover:bg-primary-700 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
          </button>
        </section>
      )}

      {activeTab === 'ai' && canManageSiteSettings && (
        <AiSettingsSection
          settings={settings}
          onSave={handleSaveAiSettings}
          onAvatarChange={(url) =>
            setSettings((previous) => (previous ? { ...previous, aiBotAvatarUrl: url } : previous))
          }
        />
      )}

      {activeTab === 'knowledge' && canManageKnowledgeBase && <KnowledgeSection />}

      {activeTab === 'operations' && canManageAutomation && <AutomationRulesSection />}

      {activeTab === 'operations' && canManageWebhooks && <WebhooksSection />}

      {activeTab === 'operations' && canManageCannedResponses && (
        <section className="rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-700">پاسخ‌های آماده</h2>
          {cannedResponses.map((response) => (
            <div
              key={response.id}
              className="mb-2 flex items-start justify-between border-b border-gray-100 pb-2 text-xs"
            >
              <div>
                <div className="font-medium text-gray-800">
                  {response.title} <span className="text-gray-400">({response.shortcut})</span>
                </div>
                <div className="text-gray-500">{response.content}</div>
              </div>
              <button
                onClick={() => handleDeleteCannedResponse(response.id)}
                className="text-red-600"
              >
                حذف
              </button>
            </div>
          ))}

          <div className="mt-3 space-y-2 rounded bg-gray-50 p-2">
            <div className="flex gap-2">
              <input
                value={newShortcut}
                onChange={(e) => setNewShortcut(e.target.value)}
                placeholder="میانبر (مثل /سلام)"
                className="w-1/3 rounded border border-gray-300 p-1.5 text-xs"
              />
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="عنوان"
                className="flex-1 rounded border border-gray-300 p-1.5 text-xs"
              />
            </div>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="متن پاسخ آماده"
              className="w-full rounded border border-gray-300 p-1.5 text-xs"
              rows={2}
            />
            <button
              onClick={handleAddCannedResponse}
              className="rounded-lg bg-primary-600 transition-colors hover:bg-primary-700 px-3 py-1.5 text-xs text-white"
            >
              افزودن پاسخ آماده
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
