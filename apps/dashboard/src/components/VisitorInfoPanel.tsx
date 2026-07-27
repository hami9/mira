import { useEffect, useState } from 'react';
import type { CustomerContextDto, VisitorInfoDto } from '@mira/shared-types';
import { apiClient } from '../api';

interface VisitorInfoPanelProps {
  conversationId: string;
}

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toLocaleString('fa-IR')} ${currency}`;
}

export function VisitorInfoPanel({ conversationId }: VisitorInfoPanelProps) {
  const [info, setInfo] = useState<VisitorInfoDto | null>(null);
  const [customerContext, setCustomerContext] = useState<CustomerContextDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    setCustomerContext(null);
    apiClient.getVisitorInfo(conversationId).then((data) => {
      if (!cancelled) setInfo(data);
    });
    apiClient.getCustomerContext(conversationId).then((data) => {
      if (!cancelled) setCustomerContext(data);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  if (!info) {
    return (
      <div className="w-64 border-r border-gray-200 bg-white p-3 text-xs text-gray-400">
        در حال بارگذاری...
      </div>
    );
  }

  return (
    <div className="w-64 overflow-y-auto border-r border-gray-200 bg-white p-3 text-xs text-gray-700">
      <div className="mb-3 text-sm font-bold text-gray-800">اطلاعات بازدیدکننده</div>

      <div className="mb-3 space-y-1">
        <div>نام: {info.name ?? '—'}</div>
        <div>ایمیل: {info.email ?? '—'}</div>
        <div>مرورگر: {info.browser ?? 'نامشخص'}</div>
        <div>سیستم‌عامل: {info.os ?? 'نامشخص'}</div>
        <div>دستگاه: {info.deviceType ?? 'desktop'}</div>
        <div>اولین بازدید: {new Date(info.firstSeenAt).toLocaleString('fa-IR')}</div>
        <div>آخرین فعالیت: {new Date(info.lastSeenAt).toLocaleString('fa-IR')}</div>
      </div>

      <div className="mb-1 font-bold text-gray-800">صفحات بازدیدشده</div>
      {info.pages.length === 0 && <div className="mb-3 text-gray-400">ثبت نشده</div>}
      <ul className="mb-3 space-y-1">
        {info.pages.map((page, index) => (
          <li key={index} className="truncate" title={page.url}>
            {page.title || page.url}
          </li>
        ))}
      </ul>

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
    </div>
  );
}
