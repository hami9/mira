import { useState } from 'react';
import type { SiteSettingsDto, UpdateSiteSettingsDto } from '@mira/shared-types';
import { API_URL } from '../config';

export function InstallSection({
  settings,
  onSave,
}: {
  settings: SiteSettingsDto;
  onSave: (patch: UpdateSiteSettingsDto) => Promise<void>;
}) {
  const [domains, setDomains] = useState(settings.allowedDomains.join('\n'));
  const [color, setColor] = useState(
    typeof settings.appearance.color === 'string' ? settings.appearance.color : '#2E6BE6',
  );
  const [position, setPosition] = useState(
    settings.appearance.position === 'bottom-left' ? 'bottom-left' : 'bottom-right',
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const origin = new URL(API_URL || window.location.origin).origin;
  const chatUrl = `${origin}/chat.html?key=${encodeURIComponent(settings.widgetKey)}`;
  const escaped = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const embed = `<script src="${escaped(origin)}/widget-dist/widget.js" data-widget-key="${escaped(settings.widgetKey)}" data-color="${escaped(color)}" data-position="${position}" defer></script>`;
  async function save() {
    setBusy(true);
    setNotice('');
    try {
      const allowed = [
        ...new Set(
          domains
            .split(/[\n,،]/)
            .map((d) => d.trim())
            .filter(Boolean)
            .map((d) => {
              const url = new URL(d);
              if (
                !['https:', 'http:'].includes(url.protocol) ||
                url.username ||
                url.password ||
                url.pathname !== '/' ||
                url.search ||
                url.hash
              )
                throw new Error();
              return url.origin;
            }),
        ),
      ];
      if (!allowed.length || allowed.length > 30) throw new Error();
      await onSave({
        allowedDomains: allowed,
        appearance: { ...settings.appearance, color, position },
      });
      setDomains(allowed.join('\n'));
      setNotice('تنظیمات نصب ذخیره شد.');
    } catch {
      setNotice('ذخیره نشد؛ حداکثر ۳۰ آدرس کامل با http یا https و بدون مسیر وارد کنید.');
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('کپی شد.');
    } catch {
      setNotice('کپی خودکار ممکن نیست؛ متن را انتخاب و کپی کنید.');
    }
  }
  return (
    <section
      className="mb-6 rounded-xl border border-gray-200 bg-white p-4"
      aria-label="نصب و شخصی‌سازی"
    >
      <h2 className="text-sm font-bold text-gray-800">نصب و شخصی‌سازی</h2>
      <p className="mt-2 text-xs leading-6 text-gray-500">
        همه امکانات نسخه نصبی آزاد و بدون اشتراک میرا در دسترس‌اند. هزینه سرور و ارائه‌دهنده هوش
        مصنوعی با صاحب نصب است.
      </p>
      <label className="mt-4 block text-xs text-gray-700">
        دامنه‌های مجاز سایت و صفحه گفتگو
        <textarea
          dir="ltr"
          value={domains}
          onChange={(e) => setDomains(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-lg border p-2 text-left"
          placeholder="https://shop.example.com"
        />
      </label>
      <button
        type="button"
        className="mt-1 text-xs text-primary-700"
        onClick={() => setDomains((old) => [...new Set([...old.split('\n'), origin])].join('\n'))}
      >
        افزودن دامنه میرا برای فعال‌کردن لینک گفتگو
      </button>
      <div className="my-4 flex flex-wrap items-center gap-4 text-xs">
        <label>
          رنگ ویجت{' '}
          <input
            aria-label="رنگ ویجت"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="mr-2 align-middle"
          />
        </label>
        <label>
          محل نمایش{' '}
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="mr-2 rounded border p-2"
          >
            <option value="bottom-right">پایین راست</option>
            <option value="bottom-left">پایین چپ</option>
          </select>
        </label>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-primary-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {busy ? 'در حال ذخیره...' : 'ذخیره ظاهر و دامنه‌ها'}
        </button>
      </div>
      <label className="block text-xs text-gray-700">
        لینک مستقیم گفتگو
        <input
          readOnly
          dir="ltr"
          value={chatUrl}
          className="my-2 w-full rounded border bg-gray-50 p-2 text-left"
        />
      </label>
      <div className="flex gap-3 text-xs">
        <button type="button" onClick={() => copy(chatUrl)} className="text-primary-700">
          کپی لینک گفتگو
        </button>
        <a href={chatUrl} target="_blank" rel="noreferrer" className="text-primary-700">
          بازکردن گفتگو
        </a>
      </div>
      {!settings.allowedDomains.includes(origin) && (
        <p className="mt-2 text-xs text-amber-700">
          برای کارکرد لینک، دامنه میرا را با دکمه بالا اضافه و ذخیره کنید.
        </p>
      )}
      <label className="mt-4 block text-xs text-gray-700">
        کد نصب سایت
        <textarea
          readOnly
          dir="ltr"
          value={embed}
          rows={3}
          className="my-2 w-full rounded border bg-gray-50 p-2 text-left font-mono"
        />
      </label>
      <button type="button" onClick={() => copy(embed)} className="text-xs text-primary-700">
        کپی کد نصب
      </button>
      <p className="mt-2 text-xs leading-6 text-gray-500">
        کد را پیش از بسته‌شدن body قرار دهید؛ در وردپرس افزونه میرا را از بخش افزودن افزونه بارگذاری
        و آدرس بالا و کلید ویجت را وارد کنید. روی هاست اشتراکی PHP هم این اتصال کار می‌کند و موتور
        میرا می‌تواند روی سرور دیگری باشد.
      </p>
      <p className="mt-2 break-all text-xs text-gray-400">شناسه سایت: {settings.id}</p>
      {notice && (
        <p role="status" className="mt-2 text-xs text-gray-700">
          {notice}
        </p>
      )}
    </section>
  );
}
