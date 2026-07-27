import { useEffect, useState } from 'react';
import type { PublicApiKeyStatusDto, WebhookDto, WebhookEventType } from '@mira/shared-types';
import { apiClient } from '../api';

const ALL_EVENTS: { value: WebhookEventType; label: string }[] = [
  { value: 'message.created', label: 'پیام جدید' },
  { value: 'conversation.resolved', label: 'مکالمه بسته شد' },
];

export function WebhooksSection() {
  const [webhooks, setWebhooks] = useState<WebhookDto[]>([]);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEventType[]>(['message.created']);
  const [saving, setSaving] = useState(false);

  const [apiKeyStatus, setApiKeyStatus] = useState<PublicApiKeyStatusDto | null>(null);
  // کلید کامل فقط یک‌بار (لحظه‌ی ساخت) از سرور می‌آید — بعد از رفرش دیگر قابل بازیابی نیست
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  useEffect(() => {
    apiClient.listWebhooks().then(setWebhooks);
    apiClient.getApiKeyStatus().then(setApiKeyStatus);
  }, []);

  function toggleEvent(event: WebhookEventType): void {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  async function handleAdd(): Promise<void> {
    if (!url.trim() || events.length === 0) return;
    setSaving(true);
    try {
      const created = await apiClient.createWebhook({ url: url.trim(), events });
      setWebhooks((prev) => [...prev, created]);
      setUrl('');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(webhook: WebhookDto): Promise<void> {
    const updated = await apiClient.updateWebhook(webhook.id, { enabled: !webhook.enabled });
    setWebhooks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  }

  async function handleDelete(id: string): Promise<void> {
    await apiClient.deleteWebhook(id);
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  }

  async function handleGenerateApiKey(): Promise<void> {
    const generated = await apiClient.generateApiKey();
    setNewApiKey(generated.apiKey);
    setApiKeyStatus(await apiClient.getApiKeyStatus());
  }

  async function handleRevokeApiKey(): Promise<void> {
    await apiClient.revokeApiKey();
    setNewApiKey(null);
    setApiKeyStatus(await apiClient.getApiKeyStatus());
  }

  return (
    <>
      <section className="mb-6 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-bold text-gray-700">کلید API عمومی</h2>
        <p className="mb-3 text-xs text-gray-500">
          برای خواندن مکالمات و پیام‌ها از بیرون (مثلاً همگام‌سازی با CRM). کلید را در هدر{' '}
          <code className="font-mono">X-API-Key</code> بفرستید.
        </p>

        {apiKeyStatus?.hasKey ? (
          <div className="mb-2 text-xs text-gray-700">
            کلید فعال: <code className="font-mono">{apiKeyStatus.keyPrefix}…</code>
            {apiKeyStatus.createdAt && (
              <span className="text-gray-500">
                {' '}
                (ساخته‌شده در {new Date(apiKeyStatus.createdAt).toLocaleDateString('fa-IR')})
              </span>
            )}
          </div>
        ) : (
          <p className="mb-2 text-xs text-gray-400">کلیدی ساخته نشده است.</p>
        )}

        {newApiKey && (
          <div className="mb-2 rounded bg-green-50 p-2 text-xs text-green-900">
            <div className="mb-1 font-bold">کلید جدید (فقط همین یک‌بار نمایش داده می‌شود):</div>
            <code className="break-all font-mono">{newApiKey}</code>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleGenerateApiKey}
            className="rounded-lg bg-primary-600 transition-colors hover:bg-primary-700 px-3 py-1.5 text-xs text-white"
          >
            {apiKeyStatus?.hasKey ? 'ساخت کلید جدید (کلید قبلی باطل می‌شود)' : 'ساخت کلید API'}
          </button>
          {apiKeyStatus?.hasKey && (
            <button onClick={handleRevokeApiKey} className="rounded px-3 py-1.5 text-xs text-red-600">
              باطل کردن کلید
            </button>
          )}
        </div>
      </section>

      <section className="mb-6 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-bold text-gray-700">وب‌هوک‌ها</h2>
        <p className="mb-3 text-xs text-gray-500">
          هر رویداد با یک POST به آدرس شما فرستاده می‌شود. امضای درخواست در هدر{' '}
          <code className="font-mono">X-Mira-Signature</code> به‌صورت{' '}
          <code className="font-mono">sha256=HMAC(secret, body)</code> است.
        </p>

        {webhooks.length === 0 && <p className="mb-3 text-xs text-gray-400">وب‌هوکی ثبت نشده است.</p>}
        {webhooks.map((webhook) => (
          <div key={webhook.id} className="mb-2 border-b border-gray-100 pb-2 text-xs">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="truncate font-medium text-gray-800" title={webhook.url}>
                  {webhook.url}
                  {!webhook.enabled && <span className="mr-2 text-gray-400">(غیرفعال)</span>}
                </div>
                <div className="text-gray-500">
                  رویدادها:{' '}
                  {webhook.events
                    .map((e) => ALL_EVENTS.find((option) => option.value === e)?.label ?? e)
                    .join('، ')}
                </div>
                <div className="mt-1 text-gray-500">
                  secret: <code className="break-all font-mono text-gray-700">{webhook.secret}</code>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => handleToggle(webhook)} className="text-primary-600">
                  {webhook.enabled ? 'غیرفعال' : 'فعال'}
                </button>
                <button onClick={() => handleDelete(webhook.id)} className="text-red-600">
                  حذف
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="mt-3 space-y-2 rounded bg-gray-50 p-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks/mira"
            className="w-full rounded border border-gray-300 p-1.5 text-xs"
          />
          <div className="flex gap-3 text-xs">
            {ALL_EVENTS.map((option) => (
              <label key={option.value} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={events.includes(option.value)}
                  onChange={() => toggleEvent(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || events.length === 0}
            className="rounded-lg bg-primary-600 transition-colors hover:bg-primary-700 px-3 py-1.5 text-xs text-white disabled:opacity-60"
          >
            {saving ? 'در حال افزودن...' : 'افزودن وب‌هوک'}
          </button>
        </div>
      </section>
    </>
  );
}
