import { useEffect, useState } from 'react';
import type { VisitorListItemDto } from '@mira/shared-types';
import { useApiClient } from '../api-context';
import { VisitorRow } from './VisitorsOnlinePage';

interface VisitorsAllPageProps {
  onOpenVisitor: (visitorId: string) => void;
  onChat: (visitorId: string) => Promise<void>;
}

// فهرست کامل بازدیدکنندگان با جست‌وجو در نام/ایمیل/شناسه
export function VisitorsAllPage({ onOpenVisitor, onChat }: VisitorsAllPageProps) {
  const apiClient = useApiClient();
  const [visitors, setVisitors] = useState<VisitorListItemDto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    let cancelled = false;
    // debounce تا با هر ضربه‌ی کیبورد یک درخواست جدا به سرور نره
    let running = false;
    const load = () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      apiClient
        .listVisitors({ search: search.trim() || undefined })
        .then((data) => {
          if (!cancelled) {
            setVisitors(data);
            setError(false);
          }
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          running = false;
          if (!cancelled) setLoading(false);
        });
    };
    const timeout = setTimeout(load, 300);
    const timer = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearInterval(timer);
    };
  }, [search]);

  return (
    <div className="mx-auto max-w-5xl overflow-y-auto p-4 md:p-7">
      <h1 className="mb-2 text-xl font-bold tracking-tight text-gray-800">همه‌ی بازدیدکنندگان</h1>
      <p className="mb-5 text-xs text-gray-400">
        اطلاعات مسیر بازدید و دسترسی مستقیم به گفتگو، در یک نگاه.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="جست‌وجو در نام، ایمیل یا شناسه‌ی بازدیدکننده..."
        className="input-base mb-5 w-full rounded-xl bg-white p-3 text-sm"
      />

      {loading && <p className="text-sm text-gray-400">در حال بارگذاری...</p>}
      {error && (
        <p role="alert" className="mb-3 text-xs text-red-600">
          دریافت بازدیدکنندگان ناموفق بود.
        </p>
      )}

      {!loading && visitors.length === 0 && (
        <div className="rounded border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
          {search ? 'بازدیدکننده‌ای با این مشخصات پیدا نشد.' : 'هنوز بازدیدکننده‌ای ثبت نشده است.'}
        </div>
      )}

      {visitors.map((visitor) => (
        <VisitorRow
          key={visitor.id}
          visitor={visitor}
          onOpen={() => onOpenVisitor(visitor.id)}
          onChat={() => onChat(visitor.id)}
        />
      ))}
    </div>
  );
}
