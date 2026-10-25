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
  return (
    <div className={compact ? 'min-w-0' : 'rounded-xl border border-gray-100 bg-gray-50/70 p-3'}>
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
              className="block truncate text-xs font-medium text-primary-700 hover:underline"
              title={page.title || page.url}
            >
              {page.title || new URL(url).pathname} ↗
            </a>
          ) : (
            <span className="text-xs text-gray-500">نشانی معتبر نیست</span>
          )}
          {url && (
            <div
              dir="ltr"
              title={url}
              className="mt-1 truncate text-left font-mono text-[10px] text-gray-400"
            >
              {url}
            </div>
          )}
          {!compact && page.visitedAt && (
            <div className="mt-1 text-[10px] text-gray-400">
              از {new Date(page.visitedAt).toLocaleTimeString('fa-IR')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
