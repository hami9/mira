import { FormEvent, useState } from 'react';
import { apiClient } from '../api';

interface LoginPageProps {
  onLoggedIn: () => void;
}

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [email, setEmail] = useState('admin@kgkala.test');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // وقتی 2FA فعاله، لاگین دومرحله‌ای می‌شه: این توکن کوتاه‌عمر مرحله‌ی اول رو نگه می‌داریم
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiClient.login(email, password);
      if (result.twoFactorRequired && result.twoFactorToken) {
        setTwoFactorToken(result.twoFactorToken);
        return;
      }
      if (result.accessToken && result.refreshToken) {
        apiClient.setTokens(result.accessToken, result.refreshToken);
        onLoggedIn();
      }
    } catch {
      setError('ورود ناموفق بود — ایمیل یا رمز عبور را بررسی کنید');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!twoFactorToken) return;
    setError(null);
    setLoading(true);
    try {
      const result = await apiClient.verifyTwoFactorLogin(twoFactorToken, code.trim());
      if (result.accessToken && result.refreshToken) {
        apiClient.setTokens(result.accessToken, result.refreshToken);
        onLoggedIn();
      }
    } catch {
      setError('کد تأیید نادرست است یا مهلت آن تمام شده');
    } finally {
      setLoading(false);
    }
  }

  if (twoFactorToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <form onSubmit={handleVerifyCode} className="w-80 rounded-lg bg-white p-6 shadow">
          <h1 className="mb-2 text-lg font-bold text-gray-800">تأیید دومرحله‌ای</h1>
          <p className="mb-4 text-xs text-gray-500">
            کد ۶ رقمی نمایش‌داده‌شده در اپلیکیشن Authenticator خود را وارد کنید.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="۱۲۳۴۵۶"
            className="mb-4 w-full rounded border border-gray-300 p-2 text-center font-mono text-lg tracking-widest"
            autoFocus
            required
          />
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.trim().length !== 6}
            className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? 'در حال بررسی...' : 'تأیید و ورود'}
          </button>
          <button
            type="button"
            onClick={() => {
              setTwoFactorToken(null);
              setCode('');
              setError(null);
            }}
            className="mt-3 w-full text-xs text-gray-500"
          >
            بازگشت
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="w-80 rounded-lg bg-white p-6 shadow">
        <h1 className="mb-4 text-lg font-bold text-gray-800">ورود اپراتور میرا</h1>
        <label className="mb-1 block text-sm text-gray-600">ایمیل</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded border border-gray-300 p-2 text-sm"
          required
        />
        <label className="mb-1 block text-sm text-gray-600">رمز عبور</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded border border-gray-300 p-2 text-sm"
          required
        />
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? 'در حال ورود...' : 'ورود'}
        </button>
      </form>
    </div>
  );
}
