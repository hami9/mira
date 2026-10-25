import { useEffect, useState } from 'react';
import type { VisitorListItemDto, VisitorStatsDto } from '@mira/shared-types';
import { useApiClient } from '../api-context';
import { PageLocation } from './PageLocation';

interface VisitorsOnlinePageProps {
  onOpenVisitor: (visitorId: string) => void;
  onChat: (visitorId: string) => Promise<void>;
}

const REFRESH_INTERVAL_MS = 15_000;

// صفحه‌ی «چه کسانی همین الان روی سایت هستند» — خودش هر ۱۵ ثانیه تازه می‌شود
export function VisitorsOnlinePage({ onOpenVisitor, onChat }: VisitorsOnlinePageProps) {
  const apiClient = useApiClient();
  const [visitors, setVisitors] = useState<VisitorListItemDto[]>([]);
  const [stats, setStats] = useState<VisitorStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function load(): void {
      Promise.all([apiClient.listVisitors({ online: true }), apiClient.getVisitorStats()])
        .then(([list, statsData]) => {
          if (cancelled) return;
          setVisitors(list);
          setStats(statsData);
          setError(false);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    load();
    const timer = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl overflow-y-auto p-4 md:p-7">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight text-gray-800">بازدیدکنندگان آنلاین</h1>
        <p className="mt-1 text-xs text-gray-400">
          مسیر مشتری را ببینید و به‌موقع گفتگو را شروع کنید.
        </p>
      </div>

      {stats && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <StatCard
            label="آنلاین همین الان"
            value={stats.onlineNow.toLocaleString('fa-IR')}
            highlight
          />
          <StatCard label="بازدید امروز" value={stats.seenToday.toLocaleString('fa-IR')} />
          <StatCard label="کل بازدیدکنندگان" value={stats.totalVisitors.toLocaleString('fa-IR')} />
        </div>
      )}

      <p className="mb-3 text-[11px] text-gray-500">
        «آنلاین» یعنی در ۵ دقیقه‌ی گذشته فعالیتی داشته است. این فهرست هر ۱۵ ثانیه به‌روز می‌شود.
      </p>

      {loading && <p className="text-sm text-gray-400">در حال بارگذاری...</p>}
      {error && (
        <p role="alert" className="mb-3 text-xs text-red-600">
          دریافت اطلاعات ناموفق بود؛ دوباره تلاش می‌کنیم.
        </p>
      )}

      {!loading && visitors.length === 0 && (
        <div className="rounded border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
          هیچ بازدیدکننده‌ای همین الان روی سایت نیست.
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

export function VisitorRow({
  visitor,
  onOpen,
  onChat,
}: {
  visitor: VisitorListItemDto;
  onOpen: () => void;
  onChat: () => Promise<void>;
}) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState(false);
  async function openChat() {
    if (opening) return;
    setOpening(true);
    setError(false);
    try {
      await onChat();
    } catch {
      setError(true);
    } finally {
      setOpening(false);
    }
  }
  return (
    <div
      data-visitor-id={visitor.id}
      className="mb-3 rounded-2xl border border-gray-200/80 bg-white p-4 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={visitor.isOnline ? 'text-green-500' : 'text-gray-300'}>●</span>
            <button
              onClick={onOpen}
              className="text-sm font-medium text-primary-700 hover:underline"
            >
              {visitor.name || visitor.email || `مهمان ${visitor.visitorRef.slice(0, 8)}`}
            </button>
            <span className="text-[10px] text-gray-400">{visitor.conversationCount} گفتگو</span>
          </div>
          {visitor.email && <div className="text-xs text-gray-400">{visitor.email}</div>}
        </div>
        <button
          type="button"
          onClick={openChat}
          disabled={opening}
          className="btn-primary shrink-0 px-3 py-2 text-xs disabled:opacity-50"
        >
          {opening ? 'در حال بازکردن…' : visitor.conversationCount ? 'بازکردن گفتگو' : 'شروع گفتگو'}
        </button>
      </div>
      <div className="mt-4 grid min-w-0 gap-3 rounded-xl bg-gray-50/80 p-3 sm:grid-cols-2">
        <PageLocation
          compact
          label={visitor.isOnline ? 'صفحهٔ فعلی' : 'آخرین صفحهٔ ثبت‌شده'}
          page={
            visitor.currentPageUrl
              ? { url: visitor.currentPageUrl, title: visitor.currentPageTitle }
              : null
          }
        />
        <PageLocation compact label="آغاز آخرین گفتگو" page={visitor.entryPage} />
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400">
        <span>{visitor.isOnline ? 'فعال در ۵ دقیقهٔ اخیر' : 'آفلاین'}</span>
        <span>آخرین فعالیت: {new Date(visitor.lastSeenAt).toLocaleTimeString('fa-IR')}</span>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          بازکردن گفتگو ناموفق بود؛ دوباره تلاش کنید.
        </p>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 text-center ${
        highlight ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${highlight ? 'text-green-700' : 'text-gray-800'}`}>
        {value}
      </div>
    </div>
  );
}
