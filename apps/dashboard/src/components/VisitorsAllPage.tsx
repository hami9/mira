import { useEffect, useState } from 'react';
import type { VisitorListItemDto } from '@mira/shared-types';
import { apiClient } from '../api';
import { VisitorRow } from './VisitorsOnlinePage';

interface VisitorsAllPageProps {
  onClose: () => void;
  onOpenVisitor: (visitorId: string) => void;
  onGoToOnline: () => void;
}

// فهرست کامل بازدیدکنندگان با جست‌وجو در نام/ایمیل/شناسه
export function VisitorsAllPage({ onClose, onOpenVisitor, onGoToOnline }: VisitorsAllPageProps) {
  const [visitors, setVisitors] = useState<VisitorListItemDto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // debounce تا با هر ضربه‌ی کیبورد یک درخواست جدا به سرور نره
    const timeout = setTimeout(() => {
      apiClient
        .listVisitors({ search: search.trim() || undefined })
        .then(setVisitors)
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  return (
    <div className="mx-auto max-w-4xl overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">همه‌ی بازدیدکنندگان</h1>
        <div className="flex gap-3 text-sm">
          <button onClick={onGoToOnline} className="text-blue-600">
            فقط آنلاین‌ها
          </button>
          <button onClick={onClose} className="text-blue-600">
            بازگشت به داشبورد
          </button>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="جست‌وجو در نام، ایمیل یا شناسه‌ی بازدیدکننده..."
        className="mb-4 w-full rounded border border-gray-300 p-2 text-sm"
      />

      {loading && <p className="text-sm text-gray-400">در حال بارگذاری...</p>}

      {!loading && visitors.length === 0 && (
        <div className="rounded border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
          {search ? 'بازدیدکننده‌ای با این مشخصات پیدا نشد.' : 'هنوز بازدیدکننده‌ای ثبت نشده است.'}
        </div>
      )}

      {visitors.map((visitor) => (
        <VisitorRow key={visitor.id} visitor={visitor} onOpen={() => onOpenVisitor(visitor.id)} />
      ))}
    </div>
  );
}
