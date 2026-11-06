import { useEffect, useRef, useState } from 'react';
import type { ModerateVisitorDto, VisitorFlag, VisitorModeration } from '@mira/shared-types';
import { useApiClient } from '../api-context';
import { FLAG_COLORS, ModerationBadges, VisitorFlags, useModerationExpiry } from './VisitorLabels';

const buttonClass =
  'min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800';

export function VisitorModerationControl({
  visitorId,
  name,
  moderation,
  allowed,
}: {
  visitorId: string;
  name: string;
  moderation?: VisitorModeration;
  allowed: boolean;
}) {
  const api = useApiClient();
  const current = useModerationExpiry(moderation);
  const [action, setAction] = useState<'block' | 'mute' | null>(null);
  const [duration, setDuration] = useState(15);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (action && dialog.current && !dialog.current.open) dialog.current.showModal();
    else if (!action) dialog.current?.close();
  }, [action]);
  async function apply(target: ModerateVisitorDto['action']) {
    setBusy(true);
    setError('');
    try {
      await api.moderateVisitor(visitorId, {
        action: target,
        ...((target === 'mute' || target === 'block') && duration > 0
          ? { durationMinutes: duration }
          : {}),
        ...(reason.trim() && (target === 'block' || target === 'mute')
          ? { reason: reason.trim() }
          : {}),
      });
      setAction(null);
      setReason('');
    } catch {
      setError('تغییر دسترسی انجام نشد؛ دسترسی حساب و اتصال را بررسی کنید.');
    } finally {
      setBusy(false);
    }
  }
  if (!allowed) return <ModerationBadges moderation={moderation} />;
  const muted = !!moderation?.mutedUntil && new Date(moderation.mutedUntil).getTime() > Date.now();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className={buttonClass}
          onClick={() => {
            if (current?.blocked) void apply('unblock');
            else {
              setError('');
              setReason('');
              setDuration(0);
              setAction('block');
            }
          }}
        >
          {current?.blocked ? 'رفع مسدودی' : 'مسدود کردن بازدیدکننده'}
        </button>
        <button
          type="button"
          disabled={busy}
          className={buttonClass}
          onClick={() => {
            if (muted) void apply('unmute');
            else {
              setError('');
              setReason('');
              setDuration(15);
              setAction('mute');
            }
          }}
        >
          {muted ? 'رفع بی‌صدایی' : 'بی‌صدا کردن بازدیدکننده'}
        </button>
      </div>
      <ModerationBadges moderation={moderation} />
      {error && !action && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <dialog
        ref={dialog}
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setAction(null);
        }}
        className="w-[min(440px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-5 text-right text-slate-800 shadow-xl backdrop:bg-slate-900/40"
        aria-labelledby={`visitor-access-${visitorId}`}
      >
        <h3 id={`visitor-access-${visitorId}`} className="text-base font-bold">
          {action === 'block' ? 'مسدود کردن بازدیدکننده' : 'بی‌صدا کردن بازدیدکننده'}
        </h3>
        <p className="mt-3 text-sm font-bold">{name}</p>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          این محدودیت فقط برای همین بازدیدکننده در همین فروشگاه است. سابقه گفتگو حفظ می‌شود و
          محدودیت قابل برداشتن است.
        </p>
        <label className="mt-4 block text-xs">
          مدت محدودیت
          <select
            aria-label="مدت محدودیت"
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
            className={`${inputClass} mt-2`}
            disabled={busy}
          >
            {action === 'block' && <option value={0}>تا زمان رفع مسدودی</option>}
            {action === 'mute' && <option value={15}>۱۵ دقیقه</option>}
            <option value={60}>یک ساعت</option>
            <option value={1440}>۲۴ ساعت</option>
            {action === 'block' && <option value={10080}>۷ روز</option>}
          </select>
        </label>
        <label className="mt-4 block text-xs">
          دلیل، اختیاری
          <textarea
            aria-label="دلیل محدودیت"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={2}
            className={`${inputClass} mt-2`}
            disabled={busy}
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-xs text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setAction(null)}
            className={buttonClass}
          >
            انصراف
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => action && void apply(action)}
            className="min-h-11 rounded-xl bg-slate-800 px-4 py-2 text-xs text-white disabled:opacity-50"
          >
            {busy ? 'در حال اعمال…' : 'تأیید محدودیت'}
          </button>
        </div>
      </dialog>
    </div>
  );
}

export function VisitorDetailsEditor({
  visitor,
  allowed,
}: {
  visitor: {
    id: string;
    name?: string | null;
    displayName?: string | null;
    flags?: VisitorFlag[];
  };
  allowed: boolean;
}) {
  const api = useApiClient();
  const [alias, setAlias] = useState(visitor.displayName ?? '');
  const [flags, setFlags] = useState<VisitorFlag[]>(visitor.flags ?? []);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState<VisitorFlag['color']>('blue');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const flagKey = JSON.stringify(visitor.flags ?? []);
  useEffect(() => {
    setAlias(visitor.displayName ?? '');
    setFlags(JSON.parse(flagKey));
  }, [visitor.id, visitor.displayName, flagKey]);
  async function save(reset = false) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.updateVisitorDetails(visitor.id, {
        displayName: reset ? null : alias.trim() || null,
        flags,
      });
      if (reset) setAlias('');
      setNotice('نام نمایشی و پرچم‌ها ذخیره شدند.');
    } catch {
      setError('ذخیره مشخصات انجام نشد؛ دوباره تلاش کنید.');
    } finally {
      setBusy(false);
    }
  }
  if (!allowed) return <VisitorFlags flags={visitor.flags} />;
  return (
    <fieldset
      disabled={busy}
      className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
    >
      <legend className="px-1 text-xs font-bold">نام و پرچم‌های داخلی</legend>
      <label className="block text-xs">
        نام نمایشی
        <input
          aria-label="نام نمایشی بازدیدکننده"
          value={alias}
          maxLength={255}
          onChange={(event) => setAlias(event.target.value)}
          className={`${inputClass} mt-2`}
          placeholder={visitor.name || 'مثلاً مشتری همکار'}
        />
      </label>
      <p className="text-[10px] leading-5 text-slate-500">
        این نام و پرچم‌ها فقط برای تیم شما هستند. نام دریافتی سایت تغییر نمی‌کند.
      </p>
      {visitor.name && (
        <p className="text-[10px] text-slate-500">نام دریافتی سایت: {visitor.name}</p>
      )}
      <div className="flex flex-wrap gap-1">
        {flags.map((flag) => (
          <button
            type="button"
            key={flag.id}
            onClick={() => setFlags(flags.filter((item) => item.id !== flag.id))}
            aria-label={`حذف پرچم ${flag.label}`}
            className={`min-h-9 rounded-full border px-2 text-[10px] ${FLAG_COLORS[flag.color]}`}
          >
            {flag.label} ×
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          aria-label="عنوان پرچم"
          value={label}
          maxLength={32}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="عنوان پرچم"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <select
          aria-label="رنگ پرچم"
          value={color}
          onChange={(event) => setColor(event.target.value as VisitorFlag['color'])}
          className="max-w-24 rounded-xl border border-slate-200 bg-white px-2 text-xs"
        >
          {Object.keys(FLAG_COLORS).map((key) => (
            <option key={key} value={key}>
              {
                {
                  red: 'قرمز',
                  amber: 'کهربایی',
                  green: 'سبز',
                  blue: 'آبی',
                  violet: 'بنفش',
                  slate: 'خاکستری',
                }[key]
              }
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={!label.trim() || flags.length >= 8}
        className={`${buttonClass} w-full`}
        onClick={() => {
          setFlags([...flags, { id: crypto.randomUUID(), label: label.trim(), color }]);
          setLabel('');
        }}
      >
        افزودن پرچم
      </button>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void save()} className={buttonClass}>
          ذخیره مشخصات بازدیدکننده
        </button>
        <button
          type="button"
          disabled={!visitor.displayName && !alias}
          onClick={() => void save(true)}
          className={buttonClass}
        >
          بازگشت به نام سایت
        </button>
      </div>
      {notice && (
        <p role="status" className="text-xs text-teal-800">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
