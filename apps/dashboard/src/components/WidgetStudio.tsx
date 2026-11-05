import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_WIDGET_APPEARANCE,
  WIDGET_ICONS,
  WIDGET_PRESETS,
  exportWidgetTemplate,
  importWidgetTemplate,
  normalizeWidgetAppearance,
  parseWidgetAppearance,
  type SiteSettingsDto,
  type UpdateSiteSettingsDto,
  type WidgetAction,
  type WidgetAppearance,
} from '@mira/shared-types';
import { AvatarUpload } from './AvatarUpload';
import { WidgetPreview } from './WidgetPreview';

interface Props {
  settings: SiteSettingsDto;
  onSave: (patch: UpdateSiteSettingsDto) => Promise<void>;
  onAvatarChange?: (url: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}
interface Draft {
  name: string;
  aiBotName: string;
  aiGreetingMessage: string;
  appearance: WidgetAppearance;
}
const inputClass =
  'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100';
const buttonClass =
  'min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-40';
const SECTIONS = [
  'هویت برند',
  'ظاهر و حرکت',
  'متن و شروع',
  'بلوک‌ها و میان‌برها',
  'امکانات',
] as const;
const iconLabels: Record<(typeof WIDGET_ICONS)[number], string> = {
  box: 'محصول',
  compare: 'مقایسه',
  truck: 'ارسال',
  headset: 'پشتیبان',
  spark: 'دستیار',
  external: 'لینک',
};
const fromSettings = (settings: SiteSettingsDto): Draft => ({
  name: settings.name,
  aiBotName: settings.aiBotName,
  aiGreetingMessage: settings.aiGreetingMessage ?? '',
  appearance: normalizeWidgetAppearance(settings.appearance),
});
const cloneAppearance = (value: WidgetAppearance): WidgetAppearance =>
  JSON.parse(JSON.stringify(value));
const cloneDraft = (value: Draft): Draft => ({
  ...value,
  appearance: cloneAppearance(value.appearance),
});
// پیش‌نویس فقط در حافظه و برای همان فروشگاه می‌ماند؛ توکن یا داده مرورگر ذخیره نمی‌شود.
const draftCache = new Map<string, { draft: Draft; saved: Draft }>();

function TextField({
  label,
  value,
  onChange,
  maxLength,
  multiline = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <label className="block min-w-0 text-xs font-medium text-slate-700">
      {label}
      {multiline ? (
        <textarea
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          rows={3}
          className={`${inputClass} mt-2 resize-y`}
        />
      ) : (
        <input
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          className={`${inputClass} mt-2`}
        />
      )}
      {hint && (
        <span className="mt-1 block text-[11px] font-normal leading-6 text-slate-500">{hint}</span>
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block text-xs font-medium text-slate-700">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} mt-2`}
      >
        {options.map(([id, title]) => (
          <option key={id} value={id}>
            {title}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionEditor({
  title,
  kind,
  actions,
  limit,
  onChange,
}: {
  title: string;
  kind: 'کارت' | 'میان‌بر';
  actions: WidgetAction[];
  limit: number;
  onChange: (actions: WidgetAction[]) => void;
}) {
  const patch = (index: number, value: Partial<WidgetAction>) =>
    onChange(
      actions.map((action, current) => (current === index ? { ...action, ...value } : action)),
    );
  const move = (index: number, step: number) => {
    const next = [...actions];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    onChange(next);
  };
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-bold text-slate-800">{title}</legend>
      {actions.length === 0 && (
        <p className="rounded-xl border border-dashed p-4 text-xs leading-6 text-slate-500">
          هنوز بلوکی ندارید. یک {kind} اضافه کنید یا از قالب آماده شروع کنید.
        </p>
      )}
      {actions.map((action, index) => {
        const number = (index + 1).toLocaleString('fa-IR');
        return (
          <div
            key={action.id}
            className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <label className="flex min-h-11 items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  aria-label={`نمایش ${kind} ${number}`}
                  checked={action.enabled}
                  onChange={(event) => patch(index, { enabled: event.target.checked })}
                  className="h-4 w-4 accent-teal-700"
                />
                {kind} {number}
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={index === 0}
                  aria-label={`بالا بردن ${kind} ${number}`}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={index === actions.length - 1}
                  aria-label={`پایین بردن ${kind} ${number}`}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={`${buttonClass} text-red-700`}
                  aria-label={`حذف ${kind} ${number}`}
                  onClick={() => onChange(actions.filter((_, current) => current !== index))}
                >
                  حذف
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label={`عنوان ${kind} ${number}`}
                value={action.label}
                maxLength={48}
                onChange={(label) => patch(index, { label })}
              />
              <SelectField
                label={`نشان ${kind} ${number}`}
                value={action.icon}
                options={WIDGET_ICONS.map((icon) => [icon, iconLabels[icon]])}
                onChange={(icon) => patch(index, { icon: icon as WidgetAction['icon'] })}
              />
              <div className="sm:col-span-2">
                <TextField
                  label={`توضیح ${kind} ${number}`}
                  value={action.hint}
                  maxLength={240}
                  onChange={(hint) => patch(index, { hint })}
                />
              </div>
              <SelectField
                label={`عملکرد ${kind} ${number}`}
                value={action.type}
                options={[
                  ['prompt', 'ارسال سوال به گفتگو'],
                  ['link', 'بازکردن لینک'],
                  ['human', 'درخواست پشتیبان'],
                ]}
                onChange={(type) =>
                  patch(index, {
                    type: type as WidgetAction['type'],
                    value: type === 'human' ? undefined : '',
                  })
                }
              />
              {action.type !== 'human' && (
                <div className="sm:col-span-2">
                  <TextField
                    label={`متن عملکرد ${kind} ${number}`}
                    value={action.value ?? ''}
                    maxLength={2000}
                    multiline={action.type === 'prompt'}
                    onChange={(value) => patch(index, { value })}
                    hint={
                      action.type === 'link'
                        ? 'آدرس کامل با https یا http؛ لینک در تب تازه باز می‌شود.'
                        : 'متنی که با انتخاب این بلوک، به گفتگو فرستاده می‌شود.'
                    }
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        className={`${buttonClass} w-full border-dashed`}
        disabled={actions.length >= limit}
        onClick={() =>
          onChange([
            ...actions,
            {
              id: crypto.randomUUID(),
              enabled: true,
              label: `${kind} تازه`,
              hint: '',
              icon: 'spark',
              type: 'prompt',
              value: 'راهنمایی می‌خواهم.',
            },
          ])
        }
      >
        افزودن {kind}
      </button>
      <p className="text-[11px] text-slate-500">
        حداکثر {limit.toLocaleString('fa-IR')} {kind}؛ تغییر ترتیب و حذف تا پیش از ذخیره، فقط روی
        پیش‌نویس اعمال می‌شود.
      </p>
    </fieldset>
  );
}

function WidgetStudioEditor({ settings, onSave, onAvatarChange, onDirtyChange }: Props) {
  const [draft, setDraft] = useState<Draft>(() =>
    cloneDraft(draftCache.get(settings.id)?.draft ?? fromSettings(settings)),
  );
  const [saved, setSaved] = useState<Draft>(() =>
    cloneDraft(draftCache.get(settings.id)?.saved ?? fromSettings(settings)),
  );
  const [avatar, setAvatar] = useState(settings.aiBotAvatarUrl ?? '');
  const [section, setSection] = useState<(typeof SECTIONS)[number]>('هویت برند');
  const [viewport, setViewport] = useState<'mobile' | 'desktop'>('mobile');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() =>
    draftCache.has(settings.id) ? 'پیش‌نویس ذخیره‌نشده این فروشگاه بازیابی شد.' : '',
  );
  const importInput = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const appearance = draft.appearance;
  const preview = normalizeWidgetAppearance(appearance);
  const setAppearance = (patch: Partial<WidgetAppearance>) => {
    setDraft((previous) => ({ ...previous, appearance: { ...previous.appearance, ...patch } }));
    setNotice('');
    setError('');
  };
  const setIdentity = (patch: Partial<Omit<Draft, 'appearance'>>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setNotice('');
    setError('');
  };
  useEffect(() => setAvatar(settings.aiBotAvatarUrl ?? ''), [settings.aiBotAvatarUrl]);
  useEffect(() => {
    if (dirty) draftCache.set(settings.id, { draft: cloneDraft(draft), saved: cloneDraft(saved) });
    else draftCache.delete(settings.id);
  }, [settings.id, draft, saved, dirty]);
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save() {
    setError('');
    setNotice('');
    if (!draft.name.trim() || !draft.aiBotName.trim()) {
      setError('نام فروشگاه و نام دستیار را وارد کنید.');
      setSection('هویت برند');
      return;
    }
    try {
      const next = {
        ...draft,
        name: draft.name.trim(),
        aiBotName: draft.aiBotName.trim(),
        appearance: parseWidgetAppearance(appearance),
      };
      setBusy(true);
      await onSave({
        name: next.name,
        aiBotName: next.aiBotName,
        aiGreetingMessage: next.aiGreetingMessage || null,
        appearance: { ...settings.appearance, ...next.appearance },
      });
      if (JSON.stringify(draftCache.get(settings.id)?.draft) === JSON.stringify(draft))
        draftCache.delete(settings.id);
      setDraft(next);
      setSaved(next);
      setNotice('ظاهر و محتوای چت منتشر شد؛ بازدیدکننده با بارگذاری دوباره آن را می‌بیند.');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'ذخیره انجام نشد؛ دوباره تلاش کنید.');
    } finally {
      setBusy(false);
    }
  }
  function discard() {
    setDraft({ ...saved, appearance: cloneAppearance(saved.appearance) });
    setError('');
    setNotice('تغییرات ذخیره‌نشده کنار گذاشته شد.');
  }
  function exportTemplate() {
    try {
      const data = exportWidgetTemplate(parseWidgetAppearance(appearance));
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'mira-widget.json';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice('قالب بدون کلیدها، شناسه فروشگاه یا عکس صادر شد.');
      setError('');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'خروجی قالب ساخته نشد.');
    }
  }
  async function importTemplate(file?: File) {
    if (!file) return;
    try {
      if (file.size > 64 * 1024) throw new Error('حجم فایل قالب باید حداکثر ۶۴ کیلوبایت باشد.');
      const next = importWidgetTemplate(await file.text());
      setAppearance(next);
      setNotice('قالب به پیش‌نویس وارد شد؛ برای اعمال روی سایت، ذخیره و انتشار را بزنید.');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'فایل قالب معتبر نیست.');
    } finally {
      if (importInput.current) importInput.current.value = '';
    }
  }

  return (
    <section aria-label="استودیو ویجت" className="min-w-0 space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-medium text-teal-700">چت، با هویت شما</p>
            <h2 className="text-lg font-bold text-slate-900">استودیو ویجت</h2>
            <p className="mt-2 max-w-xl text-xs leading-6 text-slate-500">
              از رنگ و لوگو تا مسیرهای شروع گفتگو؛ تغییرها را همین‌جا ببینید و وقتی آماده بودید
              منتشر کنید.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              role="status"
              className={`rounded-full px-3 py-2 text-[11px] ${dirty ? 'bg-amber-50 text-amber-800' : 'bg-teal-50 text-teal-800'}`}
            >
              {dirty ? 'تغییرات ذخیره‌نشده' : 'همگام با نسخه ذخیره‌شده'}
            </span>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="min-h-11 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {busy ? 'در حال انتشار…' : 'ذخیره و انتشار'}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button type="button" disabled={busy || !dirty} className={buttonClass} onClick={discard}>
            لغو تغییرات
          </button>
          <button
            type="button"
            disabled={busy}
            className={buttonClass}
            onClick={() => {
              setAppearance(cloneAppearance(DEFAULT_WIDGET_APPEARANCE));
              setNotice('ظاهر پیش‌فرض در پیش‌نمایش است؛ هنوز منتشر نشده.');
            }}
          >
            بازگشت به پیش‌فرض
          </button>
          <button type="button" disabled={busy} className={buttonClass} onClick={exportTemplate}>
            خروجی قالب
          </button>
          <button
            type="button"
            disabled={busy}
            className={buttonClass}
            onClick={() => importInput.current?.click()}
          >
            ورود قالب
          </button>
          <input
            ref={importInput}
            type="file"
            aria-label="ورود قالب"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => void importTemplate(event.target.files?.[0])}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-6 text-red-800"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-teal-50 p-3 text-xs leading-6 text-teal-800"
          >
            {notice}
          </p>
        )}
      </div>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.95fr)]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <nav
            aria-label="بخش‌های استودیو"
            className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2"
          >
            {SECTIONS.map((name) => (
              <button
                type="button"
                key={name}
                onClick={() => setSection(name)}
                aria-pressed={section === name}
                className={`min-h-11 shrink-0 rounded-xl px-3 py-2 text-xs ${section === name ? 'bg-teal-50 font-bold text-teal-800' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {name}
              </button>
            ))}
          </nav>
          <fieldset disabled={busy} className="min-w-0 space-y-5 p-4 sm:p-5">
            {section === 'هویت برند' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="نام فروشگاه"
                    value={draft.name}
                    onChange={(name) => setIdentity({ name })}
                    maxLength={255}
                  />
                  <TextField
                    label="نام دستیار"
                    value={draft.aiBotName}
                    onChange={(aiBotName) => setIdentity({ aiBotName })}
                    maxLength={100}
                  />
                </div>
                <AvatarUpload
                  value={avatar}
                  target="assistant"
                  label="لوگو یا تصویر دستیار"
                  onChange={(url) => {
                    setAvatar(url);
                    onAvatarChange?.(url);
                    setNotice('تصویر ذخیره شد؛ دیگر تغییرهای استودیو هنوز نیاز به انتشار دارند.');
                  }}
                />
                <p className="text-[11px] leading-6 text-slate-500">
                  تأیید برش، تصویر را همان لحظه ذخیره می‌کند. لغو تغییرات یا ورود قالب، تصویر
                  ذخیره‌شده را عوض نمی‌کند.
                </p>
                <TextField
                  label="پیام خوشامد دستیار"
                  value={draft.aiGreetingMessage}
                  onChange={(aiGreetingMessage) => setIdentity({ aiGreetingMessage })}
                  maxLength={2000}
                  multiline
                  hint="این پیام در تنظیمات هویت هوش مصنوعی هم مشترک است."
                />
              </>
            )}
            {section === 'ظاهر و حرکت' && (
              <>
                <fieldset>
                  <legend className="mb-3 text-sm font-bold text-slate-800">قالب‌های آماده</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {WIDGET_PRESETS.map((preset) => (
                      <button
                        type="button"
                        key={preset.id}
                        className={`${buttonClass} text-start`}
                        onClick={() => setAppearance(cloneAppearance(preset.appearance))}
                      >
                        <span className="mb-2 flex gap-1" aria-hidden="true">
                          <span
                            className="h-5 w-5 rounded-full"
                            style={{ backgroundColor: preset.appearance.color }}
                          />
                          <span
                            className="h-5 w-5 rounded-full"
                            style={{ backgroundColor: preset.appearance.accentColor }}
                          />
                        </span>
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-6 text-slate-500">
                    قالب، ظاهر و بلوک‌های پیش‌نویس را جایگزین می‌کند؛ نام، عکس و نسخه منتشرشده حفظ
                    می‌شوند.
                  </p>
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-3">
                  {(
                    [
                      ['color', 'رنگ ویجت'],
                      ['accentColor', 'رنگ مکمل'],
                      ['surfaceColor', 'رنگ زمینه'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-slate-700">
                        {label}
                        <input
                          type="color"
                          aria-label={label}
                          value={
                            /^#[\da-f]{6}$/i.test(appearance[key]) ? appearance[key] : '#ffffff'
                          }
                          onChange={(event) => setAppearance({ [key]: event.target.value })}
                          className="mt-2 block h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                        />
                      </label>
                      <input
                        aria-label={`کد ${label}`}
                        value={appearance[key]}
                        dir="ltr"
                        maxLength={7}
                        onChange={(event) => setAppearance({ [key]: event.target.value })}
                        className={`${inputClass} mt-2 font-mono`}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    label="اندازه پنجره"
                    value={appearance.panelWidth}
                    onChange={(panelWidth) =>
                      setAppearance({ panelWidth: panelWidth as WidgetAppearance['panelWidth'] })
                    }
                    options={[
                      ['compact', 'جمع‌وجور'],
                      ['comfortable', 'متعادل'],
                      ['wide', 'عریض'],
                    ]}
                  />
                  <SelectField
                    label="گردی گوشه‌ها"
                    value={appearance.radius}
                    onChange={(radius) =>
                      setAppearance({ radius: radius as WidgetAppearance['radius'] })
                    }
                    options={[
                      ['square', 'کم'],
                      ['rounded', 'گرد'],
                      ['soft', 'نرم و بزرگ'],
                    ]}
                  />
                  <SelectField
                    label="فاصله عناصر"
                    value={appearance.density}
                    onChange={(density) =>
                      setAppearance({ density: density as WidgetAppearance['density'] })
                    }
                    options={[
                      ['comfortable', 'راحت'],
                      ['compact', 'فشرده'],
                    ]}
                  />
                  <SelectField
                    label="محل نمایش ویجت"
                    value={appearance.position}
                    onChange={(position) =>
                      setAppearance({ position: position as WidgetAppearance['position'] })
                    }
                    options={[
                      ['bottom-right', 'پایین راست'],
                      ['bottom-left', 'پایین چپ'],
                    ]}
                  />
                  <SelectField
                    label="شکل دکمه شناور"
                    value={appearance.launcher.style}
                    onChange={(style) =>
                      setAppearance({
                        launcher: {
                          ...appearance.launcher,
                          style: style as WidgetAppearance['launcher']['style'],
                        },
                      })
                    }
                    options={[
                      ['pill', 'نشان و متن'],
                      ['icon', 'فقط نشان'],
                    ]}
                  />
                  <TextField
                    label="متن دکمه شناور"
                    value={appearance.launcher.label}
                    maxLength={48}
                    onChange={(label) =>
                      setAppearance({ launcher: { ...appearance.launcher, label } })
                    }
                  />
                  <SelectField
                    label="انیمیشن دکمه شناور"
                    value={appearance.motion.launcher}
                    onChange={(launcher) =>
                      setAppearance({
                        motion: {
                          ...appearance.motion,
                          launcher: launcher as WidgetAppearance['motion']['launcher'],
                        },
                      })
                    }
                    options={[
                      ['none', 'بدون حرکت'],
                      ['breathe', 'تنفس آرام'],
                      ['float', 'شناوری ملایم'],
                      ['ripple', 'موج نرم'],
                    ]}
                  />
                  <SelectField
                    label="انیمیشن پنجره"
                    value={appearance.motion.panel}
                    onChange={(panel) =>
                      setAppearance({
                        motion: {
                          ...appearance.motion,
                          panel: panel as WidgetAppearance['motion']['panel'],
                        },
                      })
                    }
                    options={[
                      ['none', 'بدون حرکت'],
                      ['rise', 'بالا آمدن'],
                      ['scale', 'بزرگ شدن نرم'],
                      ['reveal', 'آشکار شدن'],
                    ]}
                  />
                </div>
                <p className="text-[11px] leading-6 text-slate-500">
                  تنظیم کاهش حرکت بازدیدکننده همیشه بر انیمیشن‌ها اولویت دارد.
                </p>
              </>
            )}
            {section === 'متن و شروع' && (
              <>
                <TextField
                  label="برچسب بالای عنوان"
                  value={appearance.welcome.eyebrow}
                  maxLength={80}
                  onChange={(eyebrow) =>
                    setAppearance({ welcome: { ...appearance.welcome, eyebrow } })
                  }
                />
                <TextField
                  label="عنوان شروع گفتگو"
                  value={appearance.welcome.title}
                  maxLength={160}
                  multiline
                  onChange={(title) => setAppearance({ welcome: { ...appearance.welcome, title } })}
                />
                <TextField
                  label="توضیح شروع گفتگو"
                  value={appearance.welcome.description}
                  maxLength={1000}
                  multiline
                  onChange={(description) =>
                    setAppearance({ welcome: { ...appearance.welcome, description } })
                  }
                  hint="اگر خالی باشد، پیام خوشامد دستیار نمایش داده می‌شود."
                />
              </>
            )}
            {section === 'بلوک‌ها و میان‌برها' && (
              <>
                <ActionEditor
                  title="کارت‌های شروع گفتگو"
                  kind="کارت"
                  actions={appearance.welcome.cards}
                  limit={6}
                  onChange={(cards) => setAppearance({ welcome: { ...appearance.welcome, cards } })}
                />
                <div className="border-t border-slate-100 pt-5">
                  <ActionEditor
                    title="میان‌برهای پایین گفتگو"
                    kind="میان‌بر"
                    actions={appearance.actions}
                    limit={8}
                    onChange={(actions) => setAppearance({ actions })}
                  />
                </div>
              </>
            )}
            {section === 'امکانات' && (
              <div className="space-y-3">
                {(
                  [
                    ['products', 'نمایش محصولات', 'کارت محصولات تأییدشده پاسخ‌ها نمایش داده شود.'],
                    [
                      'sources',
                      'نمایش منابع پاسخ',
                      'لینک و عنوان منابع پاسخ دستیار نمایش داده شود.',
                    ],
                    ['copy', 'کپی پاسخ', 'دکمه کپی متن پاسخ در گفتگو باشد.'],
                    ['fullscreen', 'حالت تمام‌صفحه', 'بازدیدکننده بتواند پنجره را تمام‌صفحه کند.'],
                    [
                      'quickReplies',
                      'پیشنهادهای سریع',
                      'پیشنهادهای تنظیم‌شده در بخش هوش مصنوعی نمایش داده شوند.',
                    ],
                    [
                      'human',
                      'نمایش درخواست پشتیبان',
                      'کنترل‌های درخواست پشتیبان در رابط باشند؛ این تنظیم تحویل خودکار یا درخواست متنی را غیرفعال نمی‌کند.',
                    ],
                  ] as const
                ).map(([key, label, hint]) => (
                  <label
                    key={key}
                    className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3"
                  >
                    <input
                      type="checkbox"
                      aria-label={label}
                      checked={appearance.features[key]}
                      className="mt-1 h-4 w-4 accent-teal-700"
                      onChange={(event) =>
                        setAppearance({
                          features: { ...appearance.features, [key]: event.target.checked },
                        })
                      }
                    />
                    <span>
                      <span className="block text-xs font-bold text-slate-800">{label}</span>
                      <span className="mt-1 block text-[11px] leading-6 text-slate-500">
                        {hint}
                      </span>
                    </span>
                  </label>
                ))}
                <p className="text-[11px] leading-6 text-slate-500">
                  این گزینه‌ها نمایش امکانات موجود را کنترل می‌کنند؛ منبع محصول و سیاست پاسخ‌گویی از
                  تنظیمات هوش مصنوعی می‌آید.
                </p>
              </div>
            )}
          </fieldset>
        </div>
        <aside
          className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4 xl:sticky xl:top-24"
          aria-label="پیش‌نمایش زنده استودیو"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800">پیش‌نمایش زنده</h3>
            <div className="flex gap-1 rounded-xl bg-white p-1">
              {(['mobile', 'desktop'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={viewport === value}
                  onClick={() => setViewport(value)}
                  className={`min-h-11 rounded-lg px-3 text-xs ${viewport === value ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
                >
                  {value === 'mobile' ? 'موبایل' : 'دسکتاپ'}
                </button>
              ))}
            </div>
          </div>
          <WidgetPreview
            appearance={preview}
            viewport={viewport}
            assistant={{
              siteName: draft.name,
              enabled: settings.aiEnabled,
              name: draft.aiBotName,
              greeting: draft.aiGreetingMessage,
              avatarUrl: avatar || null,
              quickReplies: settings.aiPolicy.quickReplies,
            }}
          />
        </aside>
      </div>
    </section>
  );
}

export function WidgetStudio(props: Props) {
  return <WidgetStudioEditor key={props.settings.id} {...props} />;
}
