import { useEffect, useState } from 'react';
import type { TwoFactorSetupResponseDto } from '@mira/shared-types';
import { apiClient } from '../api';

// این بخش برای همه‌ی اپراتورها (نه فقط ادمین) است — هر کسی 2FA حساب خودش را مدیریت می‌کند
export function TwoFactorSection() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<TwoFactorSetupResponseDto | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiClient.getTwoFactorStatus().then((status) => setEnabled(status.enabled));
  }, []);

  async function handleStartSetup(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      setSetup(await apiClient.startTwoFactorSetup());
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const status = await apiClient.confirmTwoFactorSetup(code.trim());
      setEnabled(status.enabled);
      setSetup(null);
      setCode('');
    } catch {
      setError('کد تأیید نادرست است — کد فعلی اپلیکیشن را وارد کنید');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const status = await apiClient.disableTwoFactor(code.trim());
      setEnabled(status.enabled);
      setCode('');
    } catch {
      setError('کد تأیید نادرست است');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded border border-gray-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-bold text-gray-700">احراز هویت دومرحله‌ای (2FA)</h2>
      <p className="mb-3 text-xs text-gray-500">
        با فعال‌کردن این گزینه، هنگام ورود علاوه بر رمز عبور یک کد ۶ رقمی از اپلیکیشن Authenticator
        هم لازم است.
      </p>

      {enabled === null && <p className="text-xs text-gray-400">در حال بارگذاری...</p>}

      {enabled === true && (
        <div className="text-xs">
          <p className="mb-2 text-green-700">✓ احراز هویت دومرحله‌ای برای حساب شما فعال است.</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="کد فعلی برای غیرفعال‌سازی"
              className="rounded border border-gray-300 p-1.5 font-mono"
            />
            <button
              onClick={handleDisable}
              disabled={busy || code.trim().length !== 6}
              className="rounded px-3 py-1.5 text-red-600 disabled:opacity-60"
            >
              غیرفعال‌سازی
            </button>
          </div>
        </div>
      )}

      {enabled === false && !setup && (
        <button
          onClick={handleStartSetup}
          disabled={busy}
          className="rounded-lg bg-primary-600 transition-colors hover:bg-primary-700 px-3 py-1.5 text-xs text-white disabled:opacity-60"
        >
          {busy ? 'در حال آماده‌سازی...' : 'فعال‌سازی 2FA'}
        </button>
      )}

      {setup && (
        <div className="text-xs">
          <p className="mb-2 text-gray-600">
            ۱) این QR را با اپلیکیشن Authenticator اسکن کنید (یا کلید را دستی وارد کنید):
          </p>
          <img src={setup.qrCodeDataUrl} alt="QR کد 2FA" className="mb-2 h-40 w-40" />
          <p className="mb-3 break-all text-gray-500">
            کلید دستی: <code className="font-mono text-gray-800">{setup.secret}</code>
          </p>
          <p className="mb-2 text-gray-600">۲) کد ۶ رقمی نمایش‌داده‌شده را وارد کنید:</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="۱۲۳۴۵۶"
              className="rounded border border-gray-300 p-1.5 font-mono"
            />
            <button
              onClick={handleConfirm}
              disabled={busy || code.trim().length !== 6}
              className="rounded-lg bg-primary-600 transition-colors hover:bg-primary-700 px-3 py-1.5 text-white disabled:opacity-60"
            >
              تأیید و فعال‌سازی
            </button>
            <button onClick={() => setSetup(null)} className="px-2 text-gray-500">
              انصراف
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
