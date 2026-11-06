import { useEffect, useRef, useState } from 'react';
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
  'mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const button =
  'min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const primary =
  'min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50';
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
  const [agent, setAgent] = useState<{ id: string; role: string } | null>(null);
  const pending = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    if (mode) {
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [mode]);
  useEffect(() => {
    setMode(null);
    pending.current = null;
  }, [conversationId]);
  async function open(target: 'form' | 'link') {
    setMode(target);
    setError('');
    setEditing(false);
    setSelected(null);
    setTitle('');
    setDescription('');
    setUrl(target === 'link' ? safeHttpUrl(draft.trim()) || '' : '');
    pending.current = null;
    if (target === 'form') {
      setLoading(true);
      try {
        const [list, me] = await Promise.all([api.listChatForms(), api.getMyProfile()]);
        setForms(list);
        setAgent(me);
      } catch {
        setError('دریافت فرم‌ها انجام نشد. دوباره تلاش کنید.');
      } finally {
        setLoading(false);
      }
    }
  }
  function choose(form: ChatFormDto) {
    setSelected(form.id);
    setTitle(form.title);
    setDescription(form.description);
    setFields(form.fields.map((field) => ({ ...field, options: field.options?.slice() })));
    setEditing(false);
    setError('');
  }
  function update(index: number, patch: Partial<ChatFormField>) {
    setFields((current) =>
      current.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    );
  }
  async function save() {
    if (
      !title.trim() ||
      fields.some(
        (field) =>
          !field.label.trim() ||
          (field.type === 'select' &&
            (!field.options?.length || field.options.some((option) => !option.trim()))),
      )
    ) {
      setError('عنوان فرم، نام هر فیلد و گزینه‌های فهرست را کامل کنید.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await api.saveChatForm(
        { title: title.trim(), description: description.trim(), fields },
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
    if (mode === 'link' && !safeHttpUrl(url)) {
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
              url,
              title: title.trim() || undefined,
              description: description.trim() || undefined,
              clientMessageId: pending.current.id,
            })
          : await api.sendChatForm(conversationId, selected!, pending.current.id);
      if (activeConversation.current !== targetConversation) return;
      onSent(message);
      setMode(null);
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
    } catch {
      setError('بایگانی فرم انجام نشد؛ دسترسی را بررسی کنید.');
    } finally {
      setBusy(false);
    }
  }
  const picked = forms.find((form) => form.id === selected);
  const canEdit = !picked || agent?.role === 'admin' || picked.creatorId === agent?.id;
  const safeUrl = safeHttpUrl(url);
  const preview: MessagePayload = {
    id: 'preview',
    conversationId,
    senderType: 'agent' as MessagePayload['senderType'],
    senderId: null,
    content: '',
    createdAt: new Date().toISOString(),
    toolMetadata:
      mode === 'link'
        ? {
            kind: 'link',
            url: safeUrl || '',
            title: title.trim() || (safeUrl ? new URL(safeUrl).hostname : 'عنوان صفحه'),
            description,
            host: safeUrl ? new URL(safeUrl).hostname : '',
          }
        : {
            kind: 'form-request',
            templateId: selected || '',
            revision: 1,
            title: title || 'عنوان فرم',
            description,
            fields,
            submittedAt: null,
          },
  };
  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label="ابزارهای گفتگو">
        <button type="button" className={button} onClick={() => void open('form')}>
          ▤ ارسال فرم
        </button>
        <button type="button" className={button} onClick={() => void open('link')}>
          ↗ {safeHttpUrl(draft.trim()) ? 'ارسال به شکل کارت' : 'ارسال لینک'}
        </button>
      </div>
      <dialog
        ref={dialog}
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setMode(null);
        }}
        aria-labelledby="chat-tools-title"
        className="w-[min(900px,calc(100vw-24px))] max-h-[90dvh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-right text-slate-800 shadow-2xl backdrop:bg-slate-900/40"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold text-emerald-700">ابزارهای گفتگو</p>
            <h2 id="chat-tools-title" className="mt-1 text-lg font-bold">
              {mode === 'link' ? 'ارسال لینک به مشتری' : 'فرم‌های گفتگو'}
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
            onClick={() => setMode(null)}
          >
            ×
          </button>
        </header>
        <div className="grid gap-5 p-5 md:grid-cols-[1.2fr_1fr]">
          <section className="min-w-0 space-y-4">
            {mode === 'form' && (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      setSelected(null);
                      setTitle('');
                      setDescription('');
                      setFields([newField()]);
                      setEditing(true);
                      setError('');
                    }}
                  >
                    ساخت فرم جدید
                  </button>
                  {picked && canEdit && (
                    <>
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
                        onClick={() => void archive()}
                      >
                        بایگانی فرم
                      </button>
                    </>
                  )}
                </div>
                {loading ? (
                  <p role="status" className="text-xs text-slate-500">
                    در حال دریافت فرم‌ها…
                  </p>
                ) : (
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
                )}
                {!loading && !forms.length && !editing && (
                  <p className="rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">
                    هنوز فرمی ساخته نشده است. با «ساخت فرم جدید» شروع کنید.
                  </p>
                )}
              </>
            )}
            {mode === 'link' && (
              <label className="block text-xs">
                نشانی محصول یا صفحه
                <input
                  aria-label="نشانی لینک"
                  type="url"
                  dir="ltr"
                  placeholder="https://example.com/product"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  className={input}
                  maxLength={2048}
                  disabled={busy}
                />
              </label>
            )}
            {(mode === 'link' || editing) && (
              <>
                <label className="block text-xs">
                  {mode === 'link' ? 'عنوان کارت، اختیاری' : 'عنوان فرم'}
                  <input
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
                          maxLength={80}
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
                              options:
                                event.target.value === 'select'
                                  ? ['گزینه اول', 'گزینه دوم']
                                  : undefined,
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
                <button
                  type="button"
                  className={`${primary} ms-2`}
                  disabled={busy}
                  onClick={() => void save()}
                >
                  ذخیره فرم
                </button>
              </>
            )}
          </section>
          <aside className="min-w-0 rounded-2xl bg-slate-50 p-4">
            <h3 className="text-xs font-bold text-slate-600">پیش‌نمایش برای مشتری</h3>
            {mode === 'link' && !safeUrl ? (
              <p className="mt-6 text-xs leading-6 text-slate-400">
                نشانی را وارد کنید تا کارت لینک نمایش داده شود. عنوان و توضیح را می‌توانید خودتان
                بنویسید.
              </p>
            ) : (
              <ToolMessage message={preview} />
            )}
            <p className="mt-4 text-[10px] leading-6 text-slate-500">
              {mode === 'form'
                ? 'پاسخ مشتری در سابقه همین گفتگو ثبت می‌شود. از درخواست رمز عبور یا اطلاعات بانکی خودداری کنید.'
                : 'بازکردن کارت، صفحه را در تب جدید نمایش می‌دهد.'}
            </p>
          </aside>
        </div>
        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4">
          {error && (
            <p role="alert" className="w-full text-xs text-red-700">
              {error}
            </p>
          )}
          <span className="text-[10px] text-slate-500">پیش‌نویس پیام شما حفظ می‌شود.</span>
          <button
            type="button"
            className={primary}
            disabled={
              busy ||
              loading ||
              (mode === 'form' && (!selected || editing)) ||
              (mode === 'link' && !safeUrl)
            }
            onClick={() => void send()}
          >
            {busy ? 'در حال انجام…' : mode === 'link' ? 'ارسال کارت لینک' : 'ارسال فرم به مشتری'}
          </button>
        </footer>
      </dialog>
    </>
  );
}
