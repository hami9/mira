import { safeHttpUrl } from '@mira/shared-types';

export function PageLocation({
  label,
  page,
  compact = false,
}: {
  label: string;
  page: { url: string; title: string | null; visitedAt?: string } | null;
  compact?: boolean;
}) {
  const url = page ? safeHttpUrl(page.url) : null;
  const address = url ? new URL(url) : null;
  const age = page?.visitedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(page.visitedAt).getTime()) / 60_000))
    : null;
  return (
    <div
      className={compact ? 'min-w-0' : 'rounded-xl border border-primary-100 bg-primary-50/40 p-3'}
    >
      <div className="mb-1 text-[10px] font-medium text-gray-400">{label}</div>
      {!page ? (
        <span className="text-xs text-gray-400">ثبت نشده</span>
      ) : (
        <>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block break-words text-xs font-bold leading-6 text-primary-800 hover:underline"
              title={page.title || page.url}
            >
              {page.title || address?.pathname} ↗
            </a>
          ) : (
            <span className="text-xs text-gray-500">نشانی معتبر نیست</span>
          )}
          {url && (
            <div
              dir="ltr"
              title={url}
              className="mt-1 truncate text-left font-mono text-[10px] text-slate-500"
            >
              {address?.host}
              {address?.pathname}
              {address?.search}
            </div>
          )}
          {!compact && page.visitedAt && (
            <div className="mt-1 text-[10px] text-gray-400">
              آخرین گزارش:{' '}
              {age === 0
                ? 'چند لحظه پیش'
                : age !== null && age < 60
                  ? `${age.toLocaleString('fa-IR')} دقیقه پیش`
                  : new Date(page.visitedAt).toLocaleString('fa-IR')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
