import type { MessagePayload } from '@mira/shared-types';
import { safeHttpUrl } from '@mira/shared-types';

export function ToolMessage({
  message,
  messages = [],
}: {
  message: MessagePayload;
  messages?: MessagePayload[];
}) {
  const tool = message.toolMetadata;
  if (!tool) return null;
  if (tool.kind === 'link') {
    const url = safeHttpUrl(tool.url);
    if (!url) return null;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block min-w-0 max-w-sm overflow-hidden rounded-2xl border border-emerald-200 bg-white text-slate-800 shadow-sm"
      >
        <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 p-3">
          <span aria-hidden="true" className="rounded-xl bg-white p-2 text-xl text-emerald-700">
            ↗
          </span>
          <span dir="ltr" className="truncate text-xs text-emerald-800">
            {tool.host}
          </span>
        </div>
        <div className="p-4">
          <strong className="block break-words text-sm">{tool.title}</strong>
          {tool.description && (
            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-500">
              {tool.description}
            </p>
          )}
          <span className="mt-4 inline-flex min-h-11 items-center text-xs font-bold text-emerald-800">
            مشاهده صفحه ↗
          </span>
        </div>
      </a>
    );
  }
  if (tool.kind === 'form-request')
    return (
      <div className="mt-3 rounded-2xl border border-emerald-200 bg-white p-4 text-slate-800">
        <div className="mb-2 text-[10px] font-bold text-emerald-700">فرم ارسالی</div>
        <strong>{tool.title}</strong>
        {tool.description && <p className="mt-1 text-xs text-slate-500">{tool.description}</p>}
        <div className="mt-3 space-y-1">
          {tool.fields.map((field) => (
            <div key={field.id} className="text-xs text-slate-500">
              {field.label}
              {field.required ? ' *' : ''}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs font-bold text-emerald-800">
          {tool.submittedAt ? 'پاسخ دریافت شد ✓' : 'در انتظار تکمیل مشتری'}
        </p>
      </div>
    );
  const request = messages.find((item) => item.id === tool.requestMessageId)?.toolMetadata;
  return (
    <div className="mt-3 rounded-2xl border border-emerald-200 bg-white p-4 text-slate-800">
      <div className="mb-2 text-[10px] font-bold text-emerald-700">پاسخ فرم دریافت شد ✓</div>
      <strong>{tool.title}</strong>
      <dl className="mt-3 space-y-3">
        {Object.entries(tool.answers).map(([id, value]) => (
          <div key={id}>
            <dt className="text-[10px] text-slate-500">
              {tool.fields?.find((field) => field.id === id)?.label ||
                (request?.kind === 'form-request'
                  ? request.fields.find((field) => field.id === id)?.label || id
                  : id)}
            </dt>
            <dd className="whitespace-pre-wrap break-words text-xs">
              {typeof value === 'boolean' ? (value ? 'بله' : 'خیر') : value || '—'}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
