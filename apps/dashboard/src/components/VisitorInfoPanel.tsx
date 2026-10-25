import { useEffect, useState } from 'react';
import type { CustomerContextDto, VisitorInfoDto } from '@mira/shared-types';
import { useApiClient } from '../api-context';
import { PageLocation } from './PageLocation';

interface VisitorInfoPanelProps {
  conversationId: string;
  onClose?: () => void;
}

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toLocaleString('fa-IR')} ${currency}`;
}

export function VisitorInfoPanel({ conversationId, onClose }: VisitorInfoPanelProps) {
  const apiClient = useApiClient();
  const [info, setInfo] = useState<VisitorInfoDto | null>(null);
  const [customerContext, setCustomerContext] = useState<CustomerContextDto | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    setCustomerContext(null);
    setError(false);
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      apiClient
        .getVisitorInfo(conversationId)
        .then((data) => {
          if (!cancelled) {
            setInfo(data);
            setError(false);
          }
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    };
    load();
    const timer = setInterval(load, 10_000);
    apiClient
      .getCustomerContext(conversationId)
      .then((data) => {
        if (!cancelled) setCustomerContext(data);
      })
      .catch(() => {
        if (!cancelled)
          setCustomerContext({
            found: false,
            customerName: null,
            totalSpent: 0,
            currency: '',
            lastOrderStatus: null,
            lastOrderDate: null,
            recentOrders: [],
            currentCart: null,
          });
      });
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [conversationId]);

  if (!info) {
    return (
      <div
        role="complementary"
        aria-label="اطلاعات بازدیدکننده"
        aria-busy="true"
        className="w-72 shrink-0 border-r border-gray-200 bg-white p-4 text-xs text-gray-400"
      >
        {error ? 'دریافت اطلاعات ناموفق بود؛ دوباره تلاش می‌کنیم.' : 'در حال بارگذاری...'}
        {onClose && (
          <button onClick={onClose} className="mt-3 block text-primary-600">
            بستن اطلاعات
          </button>
        )}
      </div>
    );
  }

  return (
    <aside
      aria-label="اطلاعات بازدیدکننده"
      className="h-full w-72 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4 text-xs text-gray-700"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="font-bold text-gray-800">اطلاعات بازدیدکننده</span>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="بستن اطلاعات بازدیدکننده"
            className="rounded-lg px-2 py-1 text-lg text-gray-400 hover:bg-gray-50"
          >
            ×
          </button>
        )}
      </div>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 font-bold text-primary-600">
          {(info.name || info.email || 'م').charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">
            {info.name || info.email || `مهمان ${info.id.slice(0, 8)}`}
          </div>
          <div className={`mt-1 text-[10px] ${info.isOnline ? 'text-teal-600' : 'text-gray-400'}`}>
            {info.isOnline ? '● فعال در ۵ دقیقهٔ اخیر' : 'آفلاین'}
          </div>
        </div>
      </div>
      <div className="mb-4 space-y-3">
        <PageLocation
          label={info.isOnline ? 'صفحهٔ فعلی' : 'آخرین صفحهٔ ثبت‌شده'}
          page={info.currentPage}
        />
        <PageLocation label="صفحهٔ آغاز گفتگو" page={info.entryPage} />
        <p className="text-[10px] text-gray-400">
          آخرین فعالیت: {new Date(info.lastSeenAt).toLocaleTimeString('fa-IR')} · به‌روزرسانی هر ۱۰
          ثانیه
        </p>
        {error && (
          <p className="text-[10px] text-amber-600">
            اتصال موقتاً قطع است؛ اطلاعات قبلی نمایش داده می‌شود.
          </p>
        )}
      </div>

      <details className="mb-4 rounded-xl border border-gray-100 p-3">
        <summary className="cursor-pointer font-medium">مشخصات و دستگاه</summary>
        <div className="mt-3 space-y-2 text-gray-500">
          <div>نام: {info.name ?? '—'}</div>
          <div>ایمیل: {info.email ?? '—'}</div>
          <div>مرورگر: {info.browser ?? 'نامشخص'}</div>
          <div>سیستم‌عامل: {info.os ?? 'نامشخص'}</div>
          <div>دستگاه: {info.deviceType ?? 'desktop'}</div>
          <div>اولین بازدید: {new Date(info.firstSeenAt).toLocaleString('fa-IR')}</div>
          <div>آخرین فعالیت: {new Date(info.lastSeenAt).toLocaleString('fa-IR')}</div>
        </div>
      </details>

      <details className="mb-4 rounded-xl border border-gray-100 p-3">
        <summary className="cursor-pointer font-medium">مسیر بازدید ({info.pages.length})</summary>
        <div className="mt-3">
          {info.pages.length === 0 && <div className="mb-3 text-gray-400">ثبت نشده</div>}
          <ul className="mb-3 space-y-1">
            {info.pages.map((page, index) => (
              <li key={index} className="truncate" title={page.url}>
                <PageLocation
                  compact
                  label={new Date(page.visitedAt).toLocaleTimeString('fa-IR')}
                  page={page}
                />
              </li>
            ))}
          </ul>
        </div>
      </details>

      <div className="mb-1 font-bold text-gray-800">مشتری ووکامرس</div>
      {!customerContext && <div className="text-gray-400">در حال بارگذاری...</div>}
      {customerContext && !customerContext.found && (
        <div className="text-gray-400">اتصال ووکامرس تنظیم نشده یا مشتری پیدا نشد</div>
      )}
      {customerContext?.found && (
        <div className="space-y-1">
          <div>نام مشتری: {customerContext.customerName ?? '—'}</div>
          <div>
            مجموع خرید: {formatCurrency(customerContext.totalSpent, customerContext.currency)}
          </div>
          <div>وضعیت آخرین سفارش: {customerContext.lastOrderStatus ?? '—'}</div>
          {customerContext.currentCart && customerContext.currentCart.itemsCount > 0 && (
            <div className="rounded bg-amber-50 p-1.5 text-amber-800">
              سبد فعلی: {customerContext.currentCart.itemsCount} قلم —{' '}
              {formatCurrency(customerContext.currentCart.total, customerContext.currency)}
            </div>
          )}
          {customerContext.recentOrders.length > 0 && (
            <div className="mt-2">
              <div className="font-bold text-gray-800">سفارش‌های اخیر</div>
              <ul className="space-y-1">
                {customerContext.recentOrders.map((order) => (
                  <li key={order.id}>
                    #{order.id} — {order.status} — {formatCurrency(order.total, order.currency)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
