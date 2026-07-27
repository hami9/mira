import { FormEvent, useState, type ReactNode } from 'react';
import { apiClient } from '../api';
import { MiraLogo } from './MiraLogo';

interface LoginPageProps {
  onLoggedIn: () => void;
}

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [email, setEmail] = useState('');
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

  // پوسته‌ی مشترک دو حالت ورود: پس‌زمینه‌ی گرادیان برند + کارت با لوگوی انیمیشنی
  function shell(content: ReactNode) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden bg-brand-gradient">
        {/* هاله‌های نرم تزئینی */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="w-[22rem] animate-slide-up">
          <div className="rounded-2xl bg-white/95 p-8 shadow-brand-lg backdrop-blur">
            <div className="mb-6 flex flex-col items-center">
              <MiraLogo size={72} animated />
              <h1 className="mt-3 text-xl font-extrabold text-primary-800">میرا</h1>
              <p className="mt-1 text-xs text-gray-400">پلتفرم چت پشتیبانی هوشمند</p>
            </div>
            {content}
          </div>
          <p className="mt-4 text-center text-[11px] text-white/70">گفت‌وگویی که به قلب می‌رسد ♥</p>
        </div>
      </div>
    );
  }

  if (twoFactorToken) {
    return shell(
      <form onSubmit={handleVerifyCode}>
        <h2 className="mb-2 text-base font-bold text-gray-800">تأیید دومرحله‌ای</h2>
        <p className="mb-4 text-xs text-gray-500">
          کد ۶ رقمی نمایش‌داده‌شده در اپلیکیشن Authenticator خود را وارد کنید.
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          maxLength={6}
          placeholder="۱۲۳۴۵۶"
          className="input-base mb-4 w-full p-2.5 text-center font-mono text-lg tracking-widest"
          autoFocus
          required
        />
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.trim().length !== 6}
          className="btn-primary w-full py-2.5 text-sm font-medium shadow-brand"
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
          className="mt-3 w-full text-xs text-gray-500 transition-colors hover:text-primary-600"
        >
          بازگشت
        </button>
      </form>,
    );
  }

  return shell(
    <form onSubmit={handleSubmit}>
      <label className="mb-1 block text-sm text-gray-600">ایمیل</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        dir="ltr"
        className="input-base mb-3 w-full p-2.5 text-sm"
        autoFocus
        required
      />
      <label className="mb-1 block text-sm text-gray-600">رمز عبور</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        dir="ltr"
        className="input-base mb-4 w-full p-2.5 text-sm"
        required
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full py-2.5 text-sm font-medium shadow-brand"
      >
        {loading ? 'در حال ورود...' : 'ورود به داشبورد'}
      </button>
    </form>,
  );
}
