import { useEffect, useState } from 'react';
import { AGENT_PERMISSIONS, PERMISSION_LABELS, type AgentProfileDto } from '@mira/shared-types';
import { apiClient } from '../api';

interface AgentProfilePageProps {
  // اگر null باشد یعنی پروفایل خودِ کاربر وارد‌شده (قابل ویرایش)
  agentId: string | null;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = { admin: 'ادمین', agent: 'اپراتور' };

export function AgentProfilePage({ agentId, onClose }: AgentProfilePageProps) {
  const isOwnProfile = agentId === null;
  const [profile, setProfile] = useState<AgentProfileDto | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const request = isOwnProfile ? apiClient.getMyProfile() : apiClient.getAgentProfile(agentId!);
    request
      .then((data) => {
        setProfile(data);
        setFullName(data.fullName);
        setPhone(data.phone ?? '');
        setBio(data.bio ?? '');
        setAvatarUrl(data.avatarUrl ?? '');
      })
      .catch(() => setError('دریافت پروفایل با خطا مواجه شد'));
  }, [agentId, isOwnProfile]);

  async function handleSave(): Promise<void> {
    setError(null);
    setSaving(true);
    try {
      const updated = await apiClient.updateMyProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      });
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
      setNotice('پروفایل ذخیره شد ✓');
      setTimeout(() => setNotice(null), 2500);
    } catch {
      setError('ذخیره پروفایل با خطا مواجه شد');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(): Promise<void> {
    setError(null);
    if (newPassword.length < 8) {
      setError('رمز عبور جدید باید حداقل ۸ کاراکتر باشد');
      return;
    }
    setChangingPassword(true);
    try {
      await apiClient.changeMyPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setNotice('رمز عبور تغییر کرد ✓');
      setTimeout(() => setNotice(null), 2500);
    } catch {
      setError('تغییر رمز ناموفق بود — رمز فعلی را بررسی کنید');
    } finally {
      setChangingPassword(false);
    }
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <button onClick={onClose} className="mb-4 text-sm text-blue-600">
          بازگشت
        </button>
        <p className="text-sm text-gray-400">{error ?? 'در حال بارگذاری پروفایل...'}</p>
      </div>
    );
  }

  const grantedPermissions = AGENT_PERMISSIONS.filter(
    (permission) => profile.role === 'admin' || profile.permissions?.[permission] === true,
  );

  return (
    <div className="mx-auto max-w-2xl overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">
          {isOwnProfile ? 'پروفایل من' : `پروفایل ${profile.fullName}`}
        </h1>
        <button onClick={onClose} className="text-sm text-blue-600">
          بازگشت
        </button>
      </div>

      {notice && (
        <div className="mb-4 rounded border border-green-200 bg-green-50 p-2 text-xs text-green-700">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <section className="mb-6 rounded border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-4">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.fullName}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
              {profile.fullName.charAt(0)}
            </div>
          )}
          <div>
            <div className="text-base font-bold text-gray-800">{profile.fullName}</div>
            <div className="text-xs text-gray-500">{profile.email}</div>
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">
                {ROLE_LABELS[profile.role] ?? profile.role}
              </span>
              {profile.twoFactorEnabled && <span className="text-green-700">🔐 2FA فعال</span>}
            </div>
          </div>
        </div>
        {profile.bio && <p className="mt-3 text-xs text-gray-600">{profile.bio}</p>}
      </section>

      <section className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="کل مکالمات" value={profile.totalConversations.toLocaleString('fa-IR')} />
        <StatCard label="حل‌شده" value={profile.resolvedConversations.toLocaleString('fa-IR')} />
        <StatCard
          label="میانگین CSAT"
          value={profile.avgCsatScore !== null ? `${profile.avgCsatScore.toFixed(2)} / ۵` : '—'}
        />
      </section>

      <section className="mb-6 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-gray-700">دسترسی‌ها</h2>
        {profile.role === 'admin' ? (
          <p className="text-xs text-gray-600">این حساب ادمین است و همه‌ی دسترسی‌ها را دارد.</p>
        ) : grantedPermissions.length === 0 ? (
          <p className="text-xs text-gray-400">هیچ دسترسی خاصی داده نشده است.</p>
        ) : (
          <ul className="grid gap-1 text-xs text-gray-700 sm:grid-cols-2">
            {grantedPermissions.map((permission) => (
              <li key={permission}>✓ {PERMISSION_LABELS[permission]}</li>
            ))}
          </ul>
        )}
        {!isOwnProfile && (
          <p className="mt-2 text-[11px] text-gray-500">
            برای تغییر دسترسی‌ها به صفحه‌ی «اپراتورها» بروید.
          </p>
        )}
      </section>

      {isOwnProfile && (
        <>
          <section className="mb-6 rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-bold text-gray-700">ویرایش پروفایل</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-600">نام و نام خانوادگی</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded border border-gray-300 p-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">شماره تماس</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded border border-gray-300 p-2 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-gray-600">آدرس تصویر پروفایل (URL)</label>
                <input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded border border-gray-300 p-2 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-gray-600">درباره‌ی من</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full rounded border border-gray-300 p-2 text-xs"
                />
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {saving ? 'در حال ذخیره...' : 'ذخیره پروفایل'}
            </button>
          </section>

          <section className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-bold text-gray-700">تغییر رمز عبور</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-600">رمز عبور فعلی</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded border border-gray-300 p-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">رمز عبور جدید</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded border border-gray-300 p-2 text-xs"
                />
              </div>
            </div>
            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword}
              className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {changingPassword ? 'در حال تغییر...' : 'تغییر رمز عبور'}
            </button>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3 text-center">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-gray-800">{value}</div>
    </div>
  );
}
