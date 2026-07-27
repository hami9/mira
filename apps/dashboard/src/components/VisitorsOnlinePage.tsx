import { useEffect, useState } from 'react';
import type { VisitorListItemDto, VisitorStatsDto } from '@mira/shared-types';
import { apiClient } from '../api';

interface VisitorsOnlinePageProps {
  onOpenVisitor: (visitorId: string) => void;
}

const REFRESH_INTERVAL_MS = 15_000;

// صفحه‌ی «چه کسانی همین الان روی سایت هستند» — خودش هر ۱۵ ثانیه تازه می‌شود
export function VisitorsOnlinePage({ onOpenVisitor }: VisitorsOnlinePageProps) {
  const [visitors, setVisitors] = useState<VisitorListItemDto[]>([]);
  const [stats, setStats] = useState<VisitorStatsDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function load(): void {
      Promise.all([apiClient.listVisitors({ online: true }), apiClient.getVisitorStats()])
        .then(([list, statsData]) => {
          if (cancelled) return;
          setVisitors(list);
          setStats(statsData);
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
    <div className="mx-auto max-w-4xl overflow-y-auto p-6">
      <h1 className="mb-4 text-lg font-bold text-gray-800">بازدیدکنندگان آنلاین</h1>

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

      {!loading && visitors.length === 0 && (
        <div className="rounded border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
          هیچ بازدیدکننده‌ای همین الان روی سایت نیست.
        </div>
      )}

      {visitors.map((visitor) => (
        <VisitorRow key={visitor.id} visitor={visitor} onOpen={() => onOpenVisitor(visitor.id)} />
      ))}
    </div>
  );
}

export function VisitorRow({
  visitor,
  onOpen,
}: {
  visitor: VisitorListItemDto;
  onOpen: () => void;
}) {
  return (
    <div className="mb-2 flex items-start justify-between rounded border border-gray-200 bg-white p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={visitor.isOnline ? 'text-green-500' : 'text-gray-300'}>●</span>
          <button onClick={onOpen} className="text-sm font-medium text-primary-700 hover:underline">
            {visitor.name || visitor.email || `مهمان ${visitor.visitorRef.slice(0, 8)}`}
          </button>
          <span className="text-[10px] text-gray-400">{visitor.conversationCount} گفتگو</span>
        </div>
        {visitor.currentPageUrl && (
          <div className="mt-1 truncate text-xs text-gray-500" title={visitor.currentPageUrl}>
            📄 {visitor.currentPageTitle || visitor.currentPageUrl}
          </div>
        )}
        {visitor.email && <div className="text-xs text-gray-400">{visitor.email}</div>}
      </div>
      <div className="shrink-0 text-left text-[11px] text-gray-400">
        آخرین فعالیت
        <br />
        {new Date(visitor.lastSeenAt).toLocaleTimeString('fa-IR')}
      </div>
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
      className={`rounded border p-3 text-center ${
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
