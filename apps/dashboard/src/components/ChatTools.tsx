import { useEffect, useId, useRef, useState } from 'react';
import type {
  ChatFormDto,
  ChatFormField,
  ChatFormFieldType,
  MessagePayload,
} from '@mira/shared-types';
import { safeHttpUrl } from '@mira/shared-types';
import { useApiClient } from '../api-context';
import { ToolMessage } from './ToolMessage';

const input =
  'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const button = 'control-button';
const primary = `${button} control-button-primary`;
const danger = `${button} control-button-danger`;
const types: Record<ChatFormFieldType, string> = {
  text: 'متن کوتاه',
  textarea: 'متن بلند',
  email: 'ایمیل',
  tel: 'تلفن',
  select: 'فهرست انتخاب',
  checkbox: 'تأیید / موافقت',
};
const newField = (): ChatFormField => ({
  id: crypto.randomUUID(),
  label: '',
  type: 'text',
  required: false,
});

function FormPreview({
  title,
  description,
  fields,
}: {
  title: string;
  description: string;
  fields: ChatFormField[];
}) {
  return (
    <div className="mt-3 space-y-4 rounded-2xl border border-emerald-200 bg-white p-4">
      <div>
        <p className="break-words text-sm font-bold">{title.trim() || 'عنوان فرم'}</p>
        {description.trim() && (
          <p className="mt-1 break-words text-xs leading-6 text-slate-500">{description}</p>
        )}
      </div>
      {fields.map((field, index) => (
        <label
          key={`${field.id}:${field.type}`}
          className={
            field.type === 'checkbox' ? 'flex min-h-11 items-center gap-2 text-xs' : 'block text-xs'
          }
        >
          {field.type === 'checkbox' && (
            <input type="checkbox" className="h-4 w-4 accent-emerald-700" />
          )}
          <span>
            {field.label.trim() || `فیلد ${(index + 1).toLocaleString('fa-IR')}`}
            {field.required ? ' (الزامی)' : ''}
          </span>
          {field.type === 'select' ? (
            <select className={input} defaultValue="">
              <option value="" disabled>
                انتخاب کنید
              </option>
              {field.options
                ?.filter((option) => option.trim())
                .map((option, i) => (
                  <option key={i} value={option}>
                    {option}
                  </option>
                ))}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea className={input} rows={2} />
          ) : field.type !== 'checkbox' ? (
            <input
              className={input}
              type={field.type}
              dir={field.type === 'text' ? 'auto' : 'ltr'}
            />
          ) : null}
        </label>
      ))}
      <p className="text-xs leading-6 text-slate-500">می‌توانید فیلدها را اینجا امتحان کنید.</p>
    </div>
  );
}

export function ChatTools({
  conversationId,
  onSent,
  draft = '',
}: {
  conversationId: string;
  draft?: string;
  onSent: (message: MessagePayload) => void;
}) {
  const api = useApiClient();
  const activeConversation = useRef(conversationId);
  activeConversation.current = conversationId;
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const formTitleInput = useRef<HTMLInputElement>(null);
  const listRequest = useRef(0);
  const [mode, setMode] = useState<'form' | 'link' | null>(null);
  const [forms, setForms] = useState<ChatFormDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [fields, setFields] = useState<ChatFormField[]>([newField()]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [agent, setAgent] = useState<{ id: string; role: string } | null>(null);
  const pending = useRef<{ key: string; id: string } | null>(null);
  const draftUrl = draft.trim();
  const canSendDraftLink = draftUrl.length <= 2048 && Boolean(safeHttpUrl(draftUrl));
  useEffect(() => {
    if (mode && !dialog.current?.open) dialog.current?.showModal();
    else if (!mode) dialog.current?.close();
    if (mode === 'link')
      dialog.current?.querySelector<HTMLInputElement>('input[type=url]')?.focus();
  }, [mode]);
  useEffect(() => {
    if (editing) formTitleInput.current?.focus();
  }, [editing]);
  useEffect(() => {
    listRequest.current++;
    setMode(null);
    pending.current = null;
  }, [conversationId]);
  function close() {
    listRequest.current++;
    setMode(null);
  }
  async function loadForms() {
    const request = ++listRequest.current;
    setLoading(true);
    setListError(false);
    try {
      const [list, me] = await Promise.all([
        api.listChatForms(),
        api.getMyProfile().catch(() => null),
      ]);
      if (listRequest.current !== request) return;
      setForms(list);
      setAgent(me);
    } catch {
      if (listRequest.current === request) setListError(true);
    } finally {
      if (listRequest.current === request) setLoading(false);
    }
  }
  function open(target: 'form' | 'link') {
    setMode(target);
    setError('');
    setConfirmArchive(false);
    setLoading(false);
    setEditing(false);
    setSelected(null);
    setTitle('');
    setDescription('');
    setUrl(target === 'link' && canSendDraftLink ? draftUrl : '');
    pending.current = null;
    if (target === 'form') void loadForms();
  }
  function choose(form: ChatFormDto) {
    setSelected(form.id);
    setTitle(form.title);
    setDescription(form.description);
    setFields(form.fields.map((field) => ({ ...field, options: field.options?.slice() })));
    setEditing(false);
    setConfirmArchive(false);
    setError('');
  }
  function update(index: number, patch: Partial<ChatFormField>) {
    setFields((current) =>
      current.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    );
  }
  async function save() {
    if (!title.trim() || fields.some((field) => !field.label.trim())) {
      setError('عنوان فرم و نام هر فیلد را کامل کنید.');
      return;
    }
    const cleanedFields = fields.map((field) => ({
      ...field,
      options:
        field.type === 'select'
          ? field.options?.map((option) => option.trim()).filter(Boolean)
          : undefined,
    }));
    if (
      cleanedFields.some(
        ({ type, options }) =>
          type === 'select' &&
          (!options?.length ||
            options.length > 12 ||
            new Set(options).size !== options.length ||
            options.some((option) => option.length > 100)),
      )
    ) {
      setError('برای هر فهرست ۱ تا ۱۲ گزینه متفاوت، هرکدام تا ۱۰۰ نویسه، وارد کنید.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await api.saveChatForm(
        { title: title.trim(), description: description.trim(), fields: cleanedFields },
        selected || undefined,
      );
      setForms((current) => [saved, ...current.filter((form) => form.id !== saved.id)]);
      choose(saved);
    } catch {
      setError('ذخیره فرم انجام نشد؛ ورودی‌ها و دسترسی خود را بررسی کنید.');
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    const targetConversation = conversationId;
    const address = safeHttpUrl(url.trim());
    if (mode === 'link' && !address) {
      setError('یک نشانی کامل و معتبر با https:// یا http:// وارد کنید.');
      return;
    }
    if (mode === 'form' && !selected) return;
    const key = JSON.stringify({ conversationId, mode, selected, url, title, description });
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    setError('');
    try {
      const message =
        mode === 'link'
          ? await api.sendChatLink(conversationId, {
              url: url.trim(),
              title: title.trim() || undefined,
              description: description.trim() || undefined,
              clientMessageId: pending.current.id,
            })
          : await api.sendChatForm(conversationId, selected!, pending.current.id);
      if (activeConversation.current !== targetConversation) return;
      onSent(message);
      close();
      pending.current = null;
    } catch {
      setError('ارسال انجام نشد؛ اطلاعات حفظ شده است. دوباره تلاش کنید.');
    } finally {
      setBusy(false);
    }
  }
  async function archive() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await api.archiveChatForm(selected);
      setForms((current) => current.filter((form) => form.id !== selected));
      setSelected(null);
      setConfirmArchive(false);
    } catch {
      setError('بایگانی فرم انجام نشد؛ دسترسی را بررسی کنید.');
    } finally {
      setBusy(false);
    }
  }
  const picked = forms.find((form) => form.id === selected);
  const canEdit = !picked || agent?.role === 'admin' || picked.creatorId === agent?.id;
  const safeUrl = safeHttpUrl(url.trim());
  const preview: MessagePayload = {
    id: 'preview',
    conversationId,
    senderType: 'agent' as MessagePayload['senderType'],
    senderId: null,
    content: '',
    createdAt: new Date().toISOString(),
    toolMetadata: safeUrl
      ? {
          kind: 'link',
          url: safeUrl,
          title: title.trim() || new URL(safeUrl).hostname,
          description,
          host: new URL(safeUrl).hostname,
        }
      : undefined,
  };
  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="ابزارهای گفتگو">
        <button
          type="button"
          className={button}
          disabled={busy}
          aria-haspopup="dialog"
          onClick={() => open('form')}
        >
          <span aria-hidden="true">▤</span> ارسال فرم
        </button>
        <button
          type="button"
          className={button}
          disabled={busy}
          aria-haspopup="dialog"
          onClick={() => open('link')}
        >
          <span aria-hidden="true">↗</span> {canSendDraftLink ? 'ارسال به شکل کارت' : 'ارسال لینک'}
        </button>
      </div>
      <dialog
        ref={dialog}
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else close();
        }}
        aria-labelledby={titleId}
        className="w-[min(900px,calc(100vw-24px))] max-h-[90dvh] overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-white p-0 text-right text-slate-800 shadow-2xl backdrop:bg-slate-900/40"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10px] font-bold text-emerald-700">ابزارهای گفتگو</p>
            <h2 id={titleId} className="mt-1 text-lg font-bold">
              {mode === 'link'
                ? 'ارسال لینک به مشتری'
                : editing
                  ? picked
                    ? 'ویرایش فرم'
                    : 'ساخت فرم'
                  : 'فرم‌های گفتگو'}
            </h2>
            <p className="mt-1 text-xs leading-6 text-slate-500">
              {mode === 'link'
                ? 'لینک محصول یا صفحه را در یک کارت مرتب ارسال کنید.'
                : 'فرم بسازید، دوباره استفاده کنید و پاسخ را همین‌جا دریافت کنید.'}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            aria-label="بستن ابزار گفتگو"
            className={button}
            onClick={close}
          >
            ×
          </button>
        </header>
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1.2fr_1fr]">
          <section className="min-w-0 space-y-4">
            {mode === 'form' && !editing && (
              <>
                {loading ? (
                  <p role="status" className="text-xs text-slate-500">
                    در حال دریافت فرم‌ها…
                  </p>
                ) : listError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <p role="alert" className="mb-2 text-xs text-red-700">
                      دریافت فرم‌ها انجام نشد.
                    </p>
                    <button type="button" className={button} onClick={() => void loadForms()}>
                      تلاش دوباره
                    </button>
                  </div>
                ) : forms.length > 0 ? (
                  <label className="block text-xs">
                    فرم‌های ذخیره‌شده
                    <select
                      aria-label="فرم‌های ذخیره‌شده"
                      value={selected || ''}
                      disabled={busy}
                      className={input}
                      onChange={(event) => {
                        const form = forms.find((item) => item.id === event.target.value);
                        if (form) choose(form);
                        else {
                          setSelected(null);
                          setConfirmArchive(false);
                          setError('');
                        }
                      }}
                    >
                      <option value="">یک فرم انتخاب کنید</option>
                      {forms.map((form) => (
                        <option key={form.id} value={form.id}>
                          {form.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-bold">هنوز فرمی ندارید</p>
                    <p className="mt-1 text-xs leading-6 text-slate-500">
                      یک فرم بسازید و از آن در گفتگوهای بعدی هم استفاده کنید.
                    </p>
                  </div>
                )}
                {picked && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="break-words text-sm font-bold">{picked.title}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {picked.fields.length.toLocaleString('fa-IR')} فیلد · آماده ارسال
                    </p>
                    {canEdit && !confirmArchive && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={button}
                          disabled={busy}
                          onClick={() => setEditing(true)}
                        >
                          ویرایش فرم
                        </button>
                        <button
                          type="button"
                          className={button}
                          disabled={busy}
                          onClick={() => setConfirmArchive(true)}
                        >
                          بایگانی فرم
                        </button>
                      </div>
                    )}
                    {confirmArchive && (
                      <div className="mt-3 space-y-2">
                        <p role="status" className="text-xs leading-6">
                          این فرم از فهرست ارسال برداشته می‌شود. نسخه‌های ارسالی در گفتگو باقی
                          می‌مانند.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={danger}
                            disabled={busy}
                            onClick={() => void archive()}
                          >
                            تأیید بایگانی
                          </button>
                          <button
                            type="button"
                            className={button}
                            disabled={busy}
                            onClick={() => setConfirmArchive(false)}
                          >
                            انصراف
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className={button}
                  disabled={busy || loading}
                  onClick={() => {
                    setSelected(null);
                    setConfirmArchive(false);
                    setTitle('');
                    setDescription('');
                    setFields([newField()]);
                    setEditing(true);
                    setError('');
                  }}
                >
                  <span aria-hidden="true">+</span> ساخت فرم جدید
                </button>
              </>
            )}
            {mode === 'link' && (
              <label className="block text-xs">
                نشانی محصول یا صفحه
                <input
                  aria-label="نشانی لینک"
                  aria-invalid={Boolean(url.trim() && !safeUrl)}
                  aria-describedby={`${titleId}-link-hint`}
                  type="url"
                  dir="ltr"
                  placeholder="https://example.com/product"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  className={input}
                  maxLength={2048}
                  disabled={busy}
                />
                <span
                  id={`${titleId}-link-hint`}
                  className={`mt-1 block text-xs leading-6 ${url.trim() && !safeUrl ? 'text-red-700' : 'text-slate-500'}`}
                >
                  نشانی کامل صفحه را با https:// یا http:// وارد کنید.
                </span>
              </label>
            )}
            {(mode === 'link' || editing) && (
              <>
                <label className="block text-xs">
                  {mode === 'link' ? 'عنوان کارت، اختیاری' : 'عنوان فرم'}
                  <input
                    ref={mode === 'form' ? formTitleInput : undefined}
                    aria-label={mode === 'link' ? 'عنوان کارت' : 'عنوان فرم'}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className={input}
                    maxLength={120}
                    disabled={busy}
                  />
                </label>
                <label className="block text-xs">
                  توضیح، اختیاری
                  <textarea
                    aria-label="توضیح ابزار گفتگو"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className={input}
                    rows={2}
                    maxLength={500}
                    disabled={busy}
                  />
                </label>
              </>
            )}
            {mode === 'form' && editing && (
              <>
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <fieldset
                      key={field.id}
                      disabled={busy}
                      className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3"
                    >
                      <legend className="px-1 text-[10px] text-slate-500">
                        فیلد {(index + 1).toLocaleString('fa-IR')}
                      </legend>
                      <label className="block text-xs">
                        عنوان فیلد
                        <input
                          aria-label={`عنوان فیلد ${index + 1}`}
                          className={input}
                          maxLength={100}
                          value={field.label}
                          onChange={(event) => update(index, { label: event.target.value })}
                        />
                      </label>
                      <label className="mt-3 block text-xs">
                        نوع فیلد
                        <select
                          aria-label={`نوع فیلد ${index + 1}`}
                          className={input}
                          value={field.type}
                          onChange={(event) =>
                            update(index, {
                              type: event.target.value as ChatFormFieldType,
                              options: event.target.value === 'select' ? [''] : undefined,
                            })
                          }
                        >
                          {Object.entries(types).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {field.type === 'select' && (
                        <label className="mt-3 block text-xs">
                          گزینه‌ها، هر گزینه در یک خط
                          <textarea
                            aria-label={`گزینه‌های فیلد ${index + 1}`}
                            className={input}
                            value={field.options?.join('\n') || ''}
                            placeholder={'مثلاً پیگیری سفارش\nراهنمای خرید'}
                            rows={3}
                            onChange={(event) =>
                              update(index, { options: event.target.value.split('\n') })
                            }
                          />
                        </label>
                      )}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <label className="flex min-h-11 items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(event) => update(index, { required: event.target.checked })}
                          />
                          پاسخ الزامی
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={button}
                            disabled={index === 0}
                            aria-label={`بالا بردن فیلد ${index + 1}`}
                            onClick={() =>
                              setFields((current) => {
                                const next = [...current];
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                return next;
                              })
                            }
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className={button}
                            disabled={fields.length === 1}
                            aria-label={`حذف فیلد ${index + 1}`}
                            onClick={() =>
                              setFields((current) => current.filter((_, i) => i !== index))
                            }
                          >
                            حذف
                          </button>
                        </div>
                      </div>
                    </fieldset>
                  ))}
                </div>
                <button
                  type="button"
                  className={button}
                  disabled={busy || fields.length >= 8}
                  onClick={() => setFields((current) => [...current, newField()])}
                >
                  افزودن فیلد ({fields.length.toLocaleString('fa-IR')}/۸)
                </button>
              </>
            )}
          </section>
          <aside className="min-w-0 rounded-2xl bg-slate-50 p-4">
            <h3 className="text-xs font-bold text-slate-600">پیش‌نمایش برای مشتری</h3>
            {mode === 'form' && (editing || picked) ? (
              <FormPreview title={title} description={description} fields={fields} />
            ) : mode === 'form' ? (
              <p className="mt-3 text-xs leading-6 text-slate-500">
                برای دیدن فیلدها، یک فرم انتخاب کنید یا فرم تازه بسازید.
              </p>
            ) : !safeUrl ? (
              <p className="mt-6 text-xs leading-6 text-slate-400">
                نشانی را وارد کنید تا کارت لینک نمایش داده شود. عنوان و توضیح را می‌توانید خودتان
                بنویسید.
              </p>
            ) : (
              <ToolMessage message={preview} preview />
            )}
            <p className="mt-4 text-[10px] leading-6 text-slate-500">
              {mode === 'form'
                ? 'پاسخ مشتری در سابقه همین گفتگو ثبت می‌شود. از درخواست رمز عبور یا اطلاعات بانکی خودداری کنید.'
                : 'بازکردن کارت، صفحه را در تب جدید نمایش می‌دهد.'}
            </p>
          </aside>
        </div>
        <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-3 sm:px-5">
          {error && (
            <p role="alert" className="w-full text-xs text-red-700">
              {error}
            </p>
          )}
          {editing ? (
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => {
                if (picked) choose(picked);
                else {
                  setEditing(false);
                  setError('');
                }
              }}
            >
              انصراف از تغییرات
            </button>
          ) : (
            <span className="text-xs text-slate-500">پیش‌نویس پیام شما حفظ می‌شود.</span>
          )}
          {(mode === 'link' || editing || picked) && (
            <button
              type="button"
              className={primary}
              disabled={
                busy ||
                loading ||
                (mode === 'form' && !editing && (!selected || confirmArchive)) ||
                (mode === 'link' && !safeUrl)
              }
              onClick={() => void (editing ? save() : send())}
            >
              {busy
                ? 'در حال انجام…'
                : editing
                  ? 'ذخیره فرم'
                  : mode === 'link'
                    ? 'ارسال کارت لینک'
                    : 'ارسال فرم به مشتری'}
            </button>
          )}
        </footer>
      </dialog>
    </>
  );
}
