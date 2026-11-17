import { useEffect, useState } from 'react';
import type { WooConnectionStatusDto } from '@mira/shared-types';
import { useApiClient } from '../api-context';

const messages: Record<WooConnectionStatusDto['status'], string> = {
  connected: 'اتصال افزونه وردپرس تأیید شد.',
  'not-configured': 'ابتدا نشانی وردپرس و کلید مشترک افزونه را ذخیره کنید.',
  'auth-failed': 'کلید مشترک پذیرفته نشد. کلید افزونه و تنظیمات میرا را یکسان کنید.',
  unavailable: 'وردپرس پاسخ معتبر نداد. نشانی HTTPS، دسترسی شبکه و فعال‌بودن افزونه را بررسی کنید.',
  'plugin-update':
    'مسیر منابع پاسخ می‌دهد. برای بررسی قابلیت‌ها، افزونه میرا را به نسخه 1.5.4 یا جدیدتر به‌روز کنید.',
};

export function WooConnectionStatus() {
  const api = useApiClient();
  const [status, setStatus] = useState<WooConnectionStatusDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    setStatus(null);
    setError(false);
  }, [api]);
  async function check() {
    setBusy(true);
    setError(false);
    try {
      setStatus(await api.getWooConnectionStatus());
    } catch {
      setStatus(null);
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm text-slate-800">بررسی اتصال ووکامرس</strong>
        <button
          type="button"
          className="control-button"
          disabled={busy}
          onClick={() => void check()}
        >
          {busy ? 'در حال بررسی…' : 'آزمایش اتصال'}
        </button>
      </div>
      <p className="text-xs leading-6 text-slate-600">
        بررسی با نشانی و کلید ذخیره‌شده انجام می‌شود. تغییرات فرم را ابتدا ذخیره کنید.
      </p>
      <div role="status" aria-live="polite" className="text-xs leading-6 text-slate-700">
        {error
          ? 'بررسی انجام نشد. اتصال پنل و دسترسی حساب را بررسی و دوباره تلاش کنید.'
          : status
            ? messages[status.status]
            : ''}
      </div>
      {status?.status === 'connected' && (
        <div className="space-y-2 text-xs text-slate-700">
          <p>
            نسخه افزونه <bdi>{status.pluginVersion}</bdi>
          </p>
          <p>
            {status.woocommerceAvailable
              ? 'ووکامرس فعال است.'
              : 'ووکامرس فعال نیست. افزونه ووکامرس را در وردپرس فعال کنید.'}
          </p>
          <ul className="space-y-1">
            <li>محصولات — {status.capabilities?.products ? 'در دسترس' : 'غیرفعال'}</li>
            <li>صفحات عمومی — {status.capabilities?.pages ? 'در دسترس' : 'غیرفعال'}</li>
            <li>
              اطلاعات مشتری و سفارش —{' '}
              {status.capabilities?.customerContext ? 'در دسترس برای حساب تأییدشده' : 'غیرفعال'}
            </li>
            <li>
              شناسایی امن حساب — {status.signedIdentity ? 'فعال' : 'نیازمند به‌روزرسانی افزونه'}
            </li>
          </ul>
        </div>
      )}
      {status?.status === 'plugin-update' && (
        <a
          className="inline-flex min-h-11 items-center text-xs font-bold text-primary-700 underline"
          href="https://github.com/hami9/mira/tree/main/wordpress-plugin"
          target="_blank"
          rel="noopener noreferrer"
        >
          دریافت و راهنمای افزونه میرا ↗
        </a>
      )}
    </div>
  );
}
