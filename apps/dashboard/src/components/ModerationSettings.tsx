import { useState } from 'react';
import {
  DEFAULT_MODERATION_POLICY,
  type SiteSettingsDto,
  type UpdateSiteSettingsDto,
} from '@mira/shared-types';

export function ModerationSettings({
  settings,
  onSave,
}: {
  settings: SiteSettingsDto;
  onSave: (patch: UpdateSiteSettingsDto) => Promise<void>;
}) {
  const policy = settings.moderationPolicy ?? DEFAULT_MODERATION_POLICY;
  const [enabled, setEnabled] = useState(policy.spamEnabled);
  const [minutes, setMinutes] = useState(policy.blockMinutes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function save() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new Error();
      await onSave({ moderationPolicy: { spamEnabled: enabled, blockMinutes: minutes } });
      setNotice('محافظت از گفتگو ذخیره شد.');
    } catch {
      setError(
        'ذخیره نشد؛ مدت محدودیت را بین ۱ تا ۱۴۴۰ دقیقه وارد کنید و دسترسی حساب را بررسی کنید.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="محافظت از گفتگو"
      className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <h2 className="text-sm font-bold text-slate-800">محافظت از گفتگو</h2>
      <p className="mt-2 max-w-2xl text-xs leading-6 text-slate-500">
        ارسال تکراری یا انبوه را به‌صورت موقت متوقف کنید؛ گفتگو و سابقه مشتری حذف نمی‌شوند. محدودیت
        دستی بازدیدکننده جدا از این تنظیم است.
      </p>
      <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          aria-label="محافظت خودکار از اسپم"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          disabled={busy}
          className="h-4 w-4 accent-teal-700"
        />
        محافظت خودکار از اسپم
      </label>
      <p className="text-[11px] leading-6 text-slate-500">
        ۶ پیام تکراری در ۱۵ ثانیه یا ۱۵ پیام در ۱۰ ثانیه، محدودیت موقت فعال می‌کند.
      </p>
      <label className="mt-3 block text-xs text-slate-700">
        مدت محدودیت خودکار، دقیقه
        <input
          aria-label="مدت محدودیت خودکار"
          type="number"
          min={1}
          max={1440}
          value={minutes}
          onChange={(event) => setMinutes(Number(event.target.value))}
          disabled={busy}
          className="mr-3 min-h-11 w-24 rounded-xl border border-slate-200 p-2"
        />
      </label>
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="mt-4 min-h-11 rounded-xl bg-primary-600 px-4 text-xs text-white disabled:opacity-50"
      >
        {busy ? 'در حال ذخیره…' : 'ذخیره محافظت از گفتگو'}
      </button>
      {notice && (
        <p role="status" className="mt-3 text-xs text-teal-800">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
