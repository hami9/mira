import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { KnowledgeDocumentDto } from '@mira/shared-types';
import { useApiClient } from '../api-context';

const emptyDraft = () => ({
  id: '',
  title: '',
  content: '',
  keywords: '',
  enabled: true,
  sourceType: 'text' as 'text' | 'markdown',
});
const statusLabels = {
  pending: 'در انتظار پردازش',
  ready: 'آمادهٔ پاسخ‌گویی',
  failed: 'پردازش ناموفق',
};

export function KnowledgeSection() {
  const apiClient = useApiClient();
  const [documents, setDocuments] = useState<KnowledgeDocumentDto[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dragging, setDragging] = useState(false);
  const [filename, setFilename] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestVersion = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLFormElement>(null);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const result = await apiClient.listKnowledgeDocuments();
      if (version === requestVersion.current) setDocuments(result);
    } catch {
      if (version === requestVersion.current)
        setError('دریافت منابع ناموفق بود؛ دوباره تلاش کنید.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [apiClient]);
  useEffect(() => {
    void refresh();
    return () => {
      requestVersion.current++;
    };
  }, [refresh]);
  useEffect(() => {
    if (!documents.some((document) => document.enabled && document.status === 'pending')) return;
    const timer = setTimeout(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 10_000);
    return () => clearTimeout(timer);
  }, [documents, refresh]);
  useEffect(() => {
    if (formOpen) editor.current?.scrollIntoView({ block: 'nearest' });
  }, [formOpen, draft.id]);

  async function importFile(file: File) {
    setError('');
    setNotice('');
    if (!/\.(md|markdown)$/i.test(file.name)) {
      setError('فقط فایل Markdown با پسوند .md یا .markdown مجاز است.');
      return;
    }
    if (file.size > 64 * 1024) {
      setError('حجم فایل باید حداکثر ۶۴ کیلوبایت باشد.');
      return;
    }
    try {
      const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      if (content.includes('\0') || content.trim().length < 10) throw new Error();
      const title =
        content.match(/^#\s+(.+)$/m)?.[1]?.trim() || file.name.replace(/\.(md|markdown)$/i, '');
      setDraft((current) => ({
        ...current,
        content,
        title: current.title || title.slice(0, 255),
        sourceType: 'markdown',
      }));
      setFilename(file.name);
      setFormOpen(true);
    } catch {
      setError('فایل باید متن UTF-8 معتبر و دست‌کم ۱۰ نویسه داشته باشد.');
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    const keywords = [
      ...new Set(
        draft.keywords
          .split(/[,،\n]/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    if (keywords.length > 20 || keywords.some((value) => value.length > 60)) {
      setError('حداکثر ۲۰ کلمه یا عبارت کلیدی، هرکدام تا ۶۰ نویسه مجاز است.');
      return;
    }
    if (new TextEncoder().encode(draft.content).length > 80_000) {
      setError('متن سند بیش از حد بزرگ است؛ آن را به چند منبع کوچک‌تر تقسیم کنید.');
      return;
    }
    setSaving(true);
    requestVersion.current++;
    try {
      const payload = {
        title: draft.title.trim(),
        content: draft.content.trim(),
        keywords,
        enabled: draft.enabled,
        sourceType: draft.sourceType,
      };
      const result = draft.id
        ? await apiClient.updateKnowledgeDocument(draft.id, payload)
        : await apiClient.createKnowledgeDocument(payload);
      setDocuments((current) => [
        result,
        ...current.filter((document) => document.id !== result.id),
      ]);
      setDraft(emptyDraft());
      setFilename('');
      setFormOpen(false);
      setNotice(
        result.enabled
          ? 'منبع ذخیره شد؛ وضعیت پردازش در فهرست نمایش داده می‌شود.'
          : 'منبع غیرفعال ذخیره شد.',
      );
    } catch {
      setError('ذخیرهٔ منبع ناموفق بود؛ متن و اتصال را بررسی کنید.');
    } finally {
      setSaving(false);
    }
  }

  async function action(id: string, operation: () => Promise<void>) {
    if (busy) return;
    setBusy(id);
    setError('');
    setNotice('');
    requestVersion.current++;
    try {
      await operation();
    } catch {
      setError('انجام تغییر ناموفق بود؛ دوباره تلاش کنید.');
    } finally {
      setBusy(null);
    }
  }
  const replace = (updated: KnowledgeDocumentDto) =>
    setDocuments((current) =>
      current.map((document) => (document.id === updated.id ? updated : document)),
    );
  const visible = documents.filter((document) =>
    `${document.title} ${document.keywords.join(' ')}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  async function download(id: string) {
    const document = await apiClient.getKnowledgeDocument(id);
    const url = URL.createObjectURL(
      new Blob([document.content || ''], { type: 'text/markdown;charset=utf-8' }),
    );
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `knowledge-${id}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section aria-label="پایگاه دانش" className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">پایگاه دانش</h2>
          <p className="mt-1 text-xs leading-6 text-gray-400">
            منابع قابل جست‌وجو برای پاسخ‌های مستندِ دستیار همین فروشگاه.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600"
          >
            تازه‌سازی منابع
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(emptyDraft());
              setFilename('');
              setFormOpen(true);
              setError('');
            }}
            className="btn-primary px-4 py-2 text-xs"
          >
            افزودن منبع
          </button>
        </div>
      </header>
      <div className="grid grid-cols-3 gap-3">
        {[
          ['منابع', documents.length],
          [
            'فعال و آماده',
            documents.filter((document) => document.enabled && document.status === 'ready').length,
          ],
          [
            'استناد در پاسخ‌ها',
            documents.reduce((total, document) => total + document.usageCount, 0),
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="text-[10px] text-gray-400">{label}</div>
            <strong className="mt-2 block text-xl text-gray-800">
              {Number(value).toLocaleString('fa-IR')}
            </strong>
          </div>
        ))}
      </div>
      <p className="text-[10px] leading-5 text-gray-400">
        استفاده یعنی یک پاسخ ثبت‌شده با استناد به این منبع؛ آمار از زمان فعال‌شدن این قابلیت جمع
        می‌شود. یک پاسخ ممکن است از چند منبع استفاده کند.
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-teal-50 p-3 text-xs text-teal-700">
          {notice}
        </p>
      )}
      {formOpen && (
        <form
          ref={editor}
          onSubmit={save}
          aria-label="ویرایش منبع دانش"
          className="space-y-4 rounded-2xl border border-primary-100 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">{draft.id ? 'ویرایش منبع' : 'منبع جدید'}</h3>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-xs text-gray-400"
            >
              انصراف
            </button>
          </div>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (event.dataTransfer.files.length !== 1) {
                setError('هر منبع یک فایل دارد؛ یک فایل انتخاب کنید.');
                return;
              }
              void importFile(event.dataTransfer.files[0]);
            }}
            className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${dragging ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-gray-50/50'}`}
          >
            <input
              ref={fileInput}
              aria-label="فایل Markdown"
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
                event.target.value = '';
              }}
            />
            <p className="text-sm text-gray-600">فایل Markdown را اینجا رها کنید</p>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-primary-700"
            >
              انتخاب فایل
            </button>
            <p className="mt-2 text-[10px] text-gray-400">
              UTF-8 · .md / .markdown · حداکثر ۶۴ کیلوبایت
            </p>
            {filename && (
              <p className="mt-2 text-xs text-teal-700" dir="ltr">
                {filename}
              </p>
            )}
          </div>
          <label className="block text-xs text-gray-500">
            عنوان منبع
            <input
              required
              minLength={2}
              maxLength={255}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              className="input-base mt-2 w-full p-2.5 text-sm"
            />
          </label>
          <label className="block text-xs text-gray-500">
            کلمات کلیدی
            <input
              maxLength={1300}
              value={draft.keywords}
              onChange={(event) => setDraft({ ...draft, keywords: event.target.value })}
              placeholder="ارسال، گارانتی، مرجوعی"
              className="input-base mt-2 w-full p-2.5 text-sm"
            />
            <span className="mt-1 block text-[10px] text-gray-400">
              عبارت‌ها را با ویرگول جدا کنید؛ در آماده‌سازی جست‌وجوی معنایی استفاده می‌شوند.
            </span>
          </label>
          <label className="block text-xs text-gray-500">
            متن منبع
            <textarea
              aria-label="متن منبع"
              required
              minLength={10}
              maxLength={100000}
              value={draft.content}
              onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              rows={9}
              className="input-base mt-2 w-full resize-y p-3 text-sm leading-7"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
              className="accent-primary-600"
            />
            فعال برای پاسخ‌گویی پس از آماده‌شدن
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <p className="max-w-md text-[10px] leading-6 text-gray-400">
              ذخیره یا تغییر متن و کلمات کلیدیِ منبع فعال، پردازش در صف و هزینهٔ embedding
              ارائه‌دهنده را به همراه دارد.
            </p>
            <button
              disabled={saving}
              className="btn-primary px-4 py-2.5 text-xs disabled:opacity-50"
            >
              {saving ? 'در حال ذخیره…' : 'ذخیره منبع'}
            </button>
          </div>
        </form>
      )}
      <input
        aria-label="جست‌وجوی منابع دانش"
        placeholder="جست‌وجوی عنوان یا کلمات کلیدی…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="input-base w-full rounded-xl bg-white p-3 text-sm"
      />
      {loading && <p className="text-xs text-gray-400">در حال دریافت منابع…</p>}
      {!loading && !visible.length && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          {search ? 'منبعی پیدا نشد.' : 'اولین راهنمای فروشگاه را اضافه کنید.'}
        </div>
      )}
      {visible.map((document) => (
        <article
          key={document.id}
          data-document-id={document.id}
          className="rounded-2xl border border-gray-200 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-gray-800">{document.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                <span
                  className={`rounded-full px-2 py-1 ${!document.enabled ? 'bg-gray-100 text-gray-400' : document.status === 'ready' ? 'bg-teal-50 text-teal-700' : document.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}
                >
                  {!document.enabled ? 'غیرفعال' : statusLabels[document.status]}
                </span>
                <span className="text-gray-400">
                  {document.sourceType === 'markdown' ? 'Markdown' : 'متن'} ·{' '}
                  {document.chunkCount.toLocaleString('fa-IR')} بخش ·{' '}
                  {document.contentLength.toLocaleString('fa-IR')} نویسه
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              role="switch"
              aria-label={`فعال‌بودن ${document.title}`}
              checked={document.enabled}
              disabled={busy !== null}
              onChange={() => {
                replace({ ...document, enabled: !document.enabled });
                void action(document.id, async () => {
                  try {
                    replace(
                      await apiClient.updateKnowledgeDocument(document.id, {
                        enabled: !document.enabled,
                      }),
                    );
                  } catch (error) {
                    replace(document);
                    throw error;
                  }
                });
              }}
              className="mt-1 h-5 w-5 accent-primary-600"
            />
          </div>
          {document.keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {document.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-md bg-gray-50 px-2 py-1 text-[10px] text-gray-500"
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
            <div className="text-[10px] text-gray-400">
              {document.usageCount.toLocaleString('fa-IR')} پاسخ · آخرین استفاده:{' '}
              {document.lastUsedAt
                ? new Date(document.lastUsedAt).toLocaleString('fa-IR')
                : 'هنوز استفاده نشده'}
            </div>
            <div className="flex gap-3 text-xs">
              <button
                disabled={busy !== null}
                onClick={() => {
                  void action(document.id, async () => {
                    const result = await apiClient.getKnowledgeDocument(document.id);
                    setDraft({
                      id: result.id,
                      title: result.title,
                      content: result.content ?? '',
                      keywords: result.keywords.join('، '),
                      enabled: result.enabled,
                      sourceType: result.sourceType === 'markdown' ? 'markdown' : 'text',
                    });
                    setFilename('');
                    setFormOpen(true);
                  });
                }}
                className="text-primary-600"
              >
                ویرایش
              </button>
              <button
                disabled={busy !== null}
                onClick={() => {
                  void action(document.id, () => download(document.id));
                }}
                className="text-gray-500"
              >
                دریافت فایل
              </button>
              {document.status === 'failed' && document.enabled && (
                <button
                  disabled={busy !== null}
                  onClick={() => {
                    void action(document.id, async () =>
                      replace(await apiClient.reindexKnowledgeDocument(document.id)),
                    );
                  }}
                  className="text-amber-700"
                >
                  پردازش مجدد
                </button>
              )}
              <button
                disabled={busy !== null}
                onClick={() => {
                  if (window.confirm('این منبع و بخش‌های پردازش‌شدهٔ آن حذف شوند؟'))
                    void action(document.id, async () => {
                      await apiClient.deleteKnowledgeDocument(document.id);
                      setDocuments((current) => current.filter((item) => item.id !== document.id));
                    });
                }}
                className="text-red-500"
              >
                حذف
              </button>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
