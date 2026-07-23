import { useEffect, useState } from 'react';
import {
  WEEKDAYS,
  type BusinessHours,
  type CannedResponseDto,
  type KnowledgeDocumentDto,
  type SiteSettingsDto,
  type TriggerMessageConfig,
  type Weekday,
} from '@mira/shared-types';
import { apiClient } from '../api';

const KB_STATUS_LABELS: Record<string, string> = {
  pending: 'در حال پردازش...',
  ready: 'آماده ✓',
  failed: 'خطا در پردازش ✗',
};

interface SettingsPageProps {
  onClose: () => void;
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

export function SettingsPage({ onClose }: SettingsPageProps) {
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

  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiSystemPrompt, setAiSystemPrompt] = useState('');
  const [aiConfidenceThreshold, setAiConfidenceThreshold] = useState(0.6);

  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeDocumentDto[]>([]);
  const [newKbTitle, setNewKbTitle] = useState('');
  const [newKbContent, setNewKbContent] = useState('');
  const [kbSaving, setKbSaving] = useState(false);

  const [cannedResponses, setCannedResponses] = useState<CannedResponseDto[]>([]);
  const [newShortcut, setNewShortcut] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  useEffect(() => {
    apiClient.getSiteSettings().then((data) => {
      setSettings(data);
      setBusinessHours(data.businessHours ?? defaultBusinessHours());
      setOfflineMessage(data.offlineMessage ?? '');
      setTriggerMessage(data.triggerMessage);
      setWordpressSiteUrl(data.wordpressSiteUrl ?? '');
      setWordpressApiKey(data.wordpressApiKey ?? '');
      setAiEnabled(data.aiEnabled);
      setAiSystemPrompt(data.aiSystemPrompt ?? '');
      setAiConfidenceThreshold(data.aiConfidenceThreshold);
    });
    apiClient.listCannedResponses().then(setCannedResponses);
    refreshKnowledgeDocuments();
  }, []);

  function refreshKnowledgeDocuments(): void {
    apiClient.listKnowledgeDocuments().then(setKnowledgeDocuments);
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      await apiClient.updateSiteSettings({
        businessHours,
        offlineMessage,
        triggerMessage,
        wordpressSiteUrl: wordpressSiteUrl.trim() || null,
        wordpressApiKey: wordpressApiKey.trim() || null,
        aiEnabled,
        aiSystemPrompt: aiSystemPrompt.trim() || null,
        aiConfidenceThreshold,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddKnowledgeDocument(): Promise<void> {
    if (!newKbTitle.trim() || !newKbContent.trim()) return;
    setKbSaving(true);
    try {
      const created = await apiClient.createKnowledgeDocument({
        title: newKbTitle.trim(),
        content: newKbContent.trim(),
      });
      setKnowledgeDocuments((prev) => [created, ...prev]);
      setNewKbTitle('');
      setNewKbContent('');
    } finally {
      setKbSaving(false);
    }
  }

  async function handleDeleteKnowledgeDocument(id: string): Promise<void> {
    await apiClient.deleteKnowledgeDocument(id);
    setKnowledgeDocuments((prev) => prev.filter((document) => document.id !== id));
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

  if (!settings) {
    return <div className="p-4 text-sm text-gray-400">در حال بارگذاری تنظیمات...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">تنظیمات {settings.name}</h1>
        <button onClick={onClose} className="text-sm text-blue-600">
          بازگشت به داشبورد
        </button>
      </div>

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
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
        </button>
        {savedNotice && <span className="mr-3 text-xs text-green-600">ذخیره شد ✓</span>}
      </section>

      <section className="mb-6 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-gray-700">اتصال وردپرس/ووکامرس</h2>
        <p className="mb-3 text-gray-500">
          افزونه‌ی میرا را روی سایت وردپرس نصب کن، از صفحه تنظیمات افزونه یک «کلید API» بساز،
          و همون کلید رو اینجا هم وارد کن تا داشبورد بتونه اطلاعات سفارش مشتری رو کنار گفتگو نشون بده.
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
            onChange={(e) => setWordpressApiKey(e.target.value)}
            placeholder="همون مقداری که در تنظیمات افزونه وردپرس ساختی"
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
          className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
        </button>
      </section>

      <section className="mb-6 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-gray-700">ربات پاسخ‌گو (هوش مصنوعی)</h2>
        <label className="mb-3 flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={aiEnabled}
            onChange={(e) => setAiEnabled(e.target.checked)}
          />
          فعال باشد — به مکالمه‌های بدون اپراتور از روی پایگاه دانش پاسخ بده
        </label>
        <div className="mb-3">
          <label className="mb-1 block text-xs text-gray-600">شخصیت/دستورالعمل ربات (اختیاری)</label>
          <textarea
            value={aiSystemPrompt}
            onChange={(e) => setAiSystemPrompt(e.target.value)}
            placeholder="مثلاً: با لحن دوستانه و مثل یک فروشنده‌ی متخصص لوازم موبایل پاسخ بده."
            className="w-full rounded border border-gray-300 p-2 text-xs"
            rows={2}
          />
        </div>
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span>آستانه‌ی اطمینان (پایین‌تر از این عدد، به اپراتور محول می‌شه)</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={aiConfidenceThreshold}
            onChange={(e) => setAiConfidenceThreshold(Number(e.target.value))}
            className="w-20 rounded border border-gray-300 p-1"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
        </button>
      </section>

      <section className="mb-6 rounded border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700">پایگاه دانش (منبع پاسخ ربات)</h2>
          <button onClick={refreshKnowledgeDocuments} className="text-xs text-blue-600">
            به‌روزرسانی لیست
          </button>
        </div>
        {knowledgeDocuments.length === 0 && (
          <p className="mb-3 text-xs text-gray-400">هنوز سندی اضافه نشده است.</p>
        )}
        {knowledgeDocuments.map((document) => (
          <div
            key={document.id}
            className="mb-2 flex items-start justify-between border-b border-gray-100 pb-2 text-xs"
          >
            <div>
              <div className="font-medium text-gray-800">{document.title}</div>
              <div className="text-gray-500">
                {KB_STATUS_LABELS[document.status] ?? document.status} · {document.chunkCount} بخش
              </div>
            </div>
            <button
              onClick={() => handleDeleteKnowledgeDocument(document.id)}
              className="text-red-600"
            >
              حذف
            </button>
          </div>
        ))}
        <div className="mt-3 space-y-2 rounded bg-gray-50 p-2">
          <input
            value={newKbTitle}
            onChange={(e) => setNewKbTitle(e.target.value)}
            placeholder="عنوان سند (مثلاً «راهنمای گارانتی»)"
            className="w-full rounded border border-gray-300 p-1.5 text-xs"
          />
          <textarea
            value={newKbContent}
            onChange={(e) => setNewKbContent(e.target.value)}
            placeholder="متن کامل سند — ربات فقط از همین متن برای پاسخ استفاده می‌کند"
            className="w-full rounded border border-gray-300 p-1.5 text-xs"
            rows={4}
          />
          <button
            onClick={handleAddKnowledgeDocument}
            disabled={kbSaving}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white disabled:opacity-60"
          >
            {kbSaving ? 'در حال افزودن...' : 'افزودن سند'}
          </button>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-gray-700">پاسخ‌های آماده</h2>
        {cannedResponses.map((response) => (
          <div key={response.id} className="mb-2 flex items-start justify-between border-b border-gray-100 pb-2 text-xs">
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
            className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white"
          >
            افزودن پاسخ آماده
          </button>
        </div>
      </section>
    </div>
  );
}
