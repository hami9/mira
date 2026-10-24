import { useState } from 'react';
import type { SystemStatusDto } from '@mira/shared-types';
import { apiClient } from '../api';

function memory(bytes: number | null | undefined): string {
  return bytes == null
    ? '—'
    : `${(bytes / 1024 / 1024).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} مگابایت`;
}

export function SystemSection() {
  const [status, setStatus] = useState<SystemStatusDto | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setStatus(await apiClient.getSystemStatus());
    } catch {
      setError('دریافت وضعیت منابع ناموفق بود.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <section
      className="mb-6 rounded-xl border border-gray-200 bg-white p-4"
      aria-label="منابع سیستم"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-800">منابع و سلامت اجرا</h2>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-lg border px-3 py-2 text-xs text-primary-700 disabled:opacity-50"
        >
          {loading ? 'در حال بررسی...' : 'بررسی منابع'}
        </button>
      </div>
      <p className="mt-2 text-xs leading-6 text-gray-500">
        بررسی فقط با درخواست شما انجام می‌شود. مصرف CPU بر حسب یک هسته و از نمونه قبلی محاسبه
        می‌شود؛ مصرف سایر برنامه‌های سرور در این اعداد نیست.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
      {status && !status.authorized && (
        <p className="mt-3 text-xs leading-6 text-gray-600">
          نمایش منابع کل نصب فقط برای مدیر میزبان فعال می‌شود. شناسه این سایت را در تنظیم
          SYSTEM_SITE_ID سرور قرار دهید و سرویس را راه‌اندازی مجدد کنید.
        </p>
      )}
      {status?.authorized && (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['حافظه API', memory(status.api?.rssBytes)],
              ['حافظه پردازشگر', memory(status.worker?.rssBytes)],
              ['حجم کل دیتابیس نصب', memory(status.databaseBytes)],
              [
                'CPU پردازش API',
                status.api?.cpuPercent == null
                  ? '—'
                  : `${status.api.cpuPercent.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪`,
              ],
              ['سقف اتصال API', status.limits?.apiPool.toLocaleString('fa-IR')],
              ['سقف اتصال پردازشگر', status.limits?.workerPool.toLocaleString('fa-IR')],
              ['حداکثر کار هم‌زمان', status.limits?.workerConcurrency.toLocaleString('fa-IR')],
              [
                'CPU پردازشگر',
                status.worker?.cpuPercent == null
                  ? '—'
                  : `${status.worker.cpuPercent.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-gray-50 p-3">
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="mt-2 text-sm font-bold text-gray-800">{value}</dd>
              </div>
            ))}
          </dl>
          {status.warnings.map((warning) => (
            <p key={warning} className="mt-2 text-xs text-amber-700">
              {warning}
            </p>
          ))}
          <p className="mt-3 text-xs leading-6 text-gray-500">
            سقف حافظه و CPU، تعداد اتصال‌ها و کارهای هم‌زمان از تنظیمات میزبان تغییر می‌کنند. برای
            نصب کنار سایت از حالت کم‌مصرف استفاده کنید. اطلاعات گفتگوها با تغییر این سقف‌ها حذف
            نمی‌شوند.
          </p>
        </>
      )}
    </section>
  );
}
