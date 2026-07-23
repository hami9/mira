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

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const tokens = await apiClient.login(email, password);
      apiClient.setTokens(tokens.accessToken, tokens.refreshToken);
      onLoggedIn();
    } catch {
      setError('ورود ناموفق بود — ایمیل یا رمز عبور را بررسی کنید');
    } finally {
      setLoading(false);
    }
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
