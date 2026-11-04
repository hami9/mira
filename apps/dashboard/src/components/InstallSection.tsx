import { useState } from 'react';
import type { SiteSettingsDto, UpdateSiteSettingsDto } from '@mira/shared-types';
import { API_URL } from '../config';

const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
const colorText = (value: string) => {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return 1.05 / (luminance + 0.05) >= 4.5 ? '#ffffff' : '#000000';
};

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
  const [accentColor, setAccentColor] = useState(
    typeof settings.appearance.accentColor === 'string'
      ? settings.appearance.accentColor
      : '#168B6A',
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
  const embed = `<script src="${escaped(origin)}/widget-dist/widget.js" data-widget-key="${escaped(settings.widgetKey)}" defer></script>`;
  const previewColor = isHexColor(color) ? color : '#2E6BE6';
  const previewAccent = isHexColor(accentColor) ? accentColor : '#168B6A';
  async function save() {
    if (!isHexColor(color) || !isHexColor(accentColor)) {
      setNotice('هر رنگ را با کد شش‌رقمی مانند #168B6A وارد کنید.');
      return;
    }
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
        appearance: { ...settings.appearance, color, accentColor, position },
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
      <div className="my-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex flex-wrap gap-4 text-xs">
            <div>
              <label className="block text-gray-700" htmlFor="widget-primary-color">
                رنگ ویجت
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="widget-primary-color"
                  aria-label="رنگ ویجت"
                  type="color"
                  value={previewColor}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-11 w-11 cursor-pointer rounded border p-1"
                />
                <input
                  aria-label="کد رنگ ویجت"
                  dir="ltr"
                  value={color}
                  maxLength={7}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-24 rounded-lg border px-2 py-2 text-left font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-700" htmlFor="widget-accent-color">
                رنگ مکمل
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="widget-accent-color"
                  aria-label="رنگ مکمل"
                  type="color"
                  value={previewAccent}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-11 w-11 cursor-pointer rounded border p-1"
                />
                <input
                  aria-label="کد رنگ مکمل"
                  dir="ltr"
                  value={accentColor}
                  maxLength={7}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-24 rounded-lg border px-2 py-2 text-left font-mono"
                />
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="ترکیب رنگ‌های پیشنهادی">
            {[
              ['آبی و سبز میرا', '#2E6BE6', '#168B6A'],
              ['سبز جنگلی', '#145C47', '#56BDA0'],
              ['آلو و نعنا', '#6A3761', '#299C83'],
            ].map(([label, primary, accent]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setColor(primary);
                  setAccentColor(accent);
                }}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 px-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <span className="flex" aria-hidden="true">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: primary }} />
                  <span
                    className="-mr-1 h-3 w-3 rounded-full ring-1 ring-white"
                    style={{ backgroundColor: accent }}
                  />
                </span>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-6 text-gray-500">
            هر دو رنگ پس از ذخیره و بارگذاری دوباره چت اعمال می‌شوند.
          </p>
        </div>
        <figure
          className="m-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50"
          aria-label="پیش‌نمایش رنگ‌های گفتگو"
        >
          <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
            <span
              className="grid h-9 w-9 place-items-center rounded-xl font-bold"
              style={{ backgroundColor: previewColor, color: colorText(previewColor) }}
            >
              م
            </span>
            <div>
              <div className="text-xs font-bold text-gray-800">دستیار میرا</div>
              <div className="text-[10px] text-gray-500">رنگ‌های گفتگوی شما</div>
            </div>
            <span
              className="mr-auto h-2 w-2 rounded-full"
              style={{ backgroundColor: previewAccent }}
              aria-hidden="true"
            />
          </div>
          <div className="space-y-3 p-4">
            <div
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700"
              style={{ borderInlineStart: `3px solid ${previewAccent}` }}
            >
              سلام، چطور می‌توانم کمکتان کنم؟
            </div>
            <div
              className="mr-auto w-fit rounded-xl px-3 py-2 text-xs"
              style={{ backgroundColor: previewColor, color: colorText(previewColor) }}
            >
              راهنمایی می‌خواهم
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
              <span>پیام شما…</span>
              <span
                className="rounded-lg px-3 py-1"
                style={{ backgroundColor: previewAccent, color: colorText(previewAccent) }}
              >
                ارسال
              </span>
            </div>
          </div>
          <figcaption className="px-4 pb-3 text-[10px] text-gray-500">
            پیش‌نمایش ترکیب رنگ
          </figcaption>
        </figure>
      </div>
      <div className="my-4 flex flex-wrap items-center gap-4 text-xs">
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
          aria-label="کد نصب سایت"
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
