import { useEffect, useState } from 'react';
import {
  AGENT_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  PERMISSION_PRESETS,
  type AgentDto,
  type AgentPermission,
  type AgentPermissionMap,
} from '@mira/shared-types';
import { apiClient } from '../api';

interface AgentsPageProps {
  onOpenProfile: (agentId: string) => void;
}

const ROLE_LABELS: Record<string, string> = { admin: 'ادمین', agent: 'اپراتور' };
const STATUS_LABELS: Record<string, string> = {
  online: 'آنلاین',
  busy: 'مشغول',
  offline: 'آفلاین',
};

export function AgentsPage({ onOpenProfile }: AgentsPageProps) {
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'agent'>('agent');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // اپراتوری که پنل دسترسی‌هایش باز است
  const [editingPermissionsFor, setEditingPermissionsFor] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  function refresh(): void {
    setLoading(true);
    apiClient
      .listAgents()
      .then(setAgents)
      .catch(() => setError('دریافت فهرست اپراتورها با خطا مواجه شد'))
      .finally(() => setLoading(false));
  }

  async function handleCreate(): Promise<void> {
    setError(null);
    if (!email.trim() || !fullName.trim() || password.length < 8) {
      setError('ایمیل، نام و رمز عبور (حداقل ۸ کاراکتر) الزامی است');
      return;
    }
    setSaving(true);
    try {
      const created = await apiClient.createAgent({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        role,
        phone: phone.trim() || null,
      });
      setAgents((prev) => [...prev, created]);
      setEmail('');
      setFullName('');
      setPassword('');
      setPhone('');
      setRole('agent');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ساخت اپراتور با خطا مواجه شد');
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(agent: AgentDto, newRole: 'admin' | 'agent'): Promise<void> {
    setError(null);
    try {
      const updated = await apiClient.updateAgent(agent.id, { role: newRole });
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تغییر نقش با خطا مواجه شد');
    }
  }

  async function savePermissions(agent: AgentDto, next: AgentPermissionMap): Promise<void> {
    setError(null);
    try {
      const updated = await apiClient.updateAgent(agent.id, { permissions: next });
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تغییر دسترسی با خطا مواجه شد');
    }
  }

  function handlePermissionToggle(agent: AgentDto, permission: AgentPermission): Promise<void> {
    return savePermissions(agent, {
      ...agent.permissions,
      [permission]: !agent.permissions?.[permission],
    });
  }

  function handleApplyPreset(agent: AgentDto, permissions: AgentPermission[]): Promise<void> {
    // الگو جایگزین کامل می‌شود (نه ادغام) تا نتیجه دقیقاً همان چیزی باشد که در توضیح الگو نوشته شده
    const next: AgentPermissionMap = {};
    for (const permission of permissions) next[permission] = true;
    return savePermissions(agent, next);
  }

  function handleClearPermissions(agent: AgentDto): Promise<void> {
    return savePermissions(agent, {});
  }

  function countGranted(agent: AgentDto): number {
    return AGENT_PERMISSIONS.filter((p) => agent.permissions?.[p] === true).length;
  }

  async function handleDelete(agent: AgentDto): Promise<void> {
    setError(null);
    try {
      await apiClient.deleteAgent(agent.id);
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حذف اپراتور با خطا مواجه شد');
    }
  }

  return (
    <div className="mx-auto max-w-4xl overflow-y-auto p-6">
      <h1 className="mb-4 text-lg font-bold text-gray-800">مدیریت اپراتورها و دسترسی‌ها</h1>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4">
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded-lg bg-primary-600 transition-colors hover:bg-primary-700 px-4 py-2 text-sm text-white"
        >
          {showForm ? 'بستن فرم' : '+ افزودن اپراتور جدید'}
        </button>
      </div>

      {showForm && (
        <section className="mb-6 rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-700">اپراتور جدید</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-600">نام و نام خانوادگی</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثلاً: زهرا محمدی"
                className="w-full rounded border border-gray-300 p-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">ایمیل (نام کاربری ورود)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@example.com"
                className="w-full rounded border border-gray-300 p-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">رمز عبور (حداقل ۸ کاراکتر)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-gray-300 p-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">شماره تماس (اختیاری)</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="۰۹۱۲..."
                className="w-full rounded border border-gray-300 p-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">نقش</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'agent')}
                className="w-full rounded border border-gray-300 p-2 text-xs"
              >
                <option value="agent">اپراتور</option>
                <option value="admin">ادمین (دسترسی کامل)</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="mt-3 rounded bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {saving ? 'در حال ساخت...' : 'ساخت حساب'}
          </button>
          <p className="mt-2 text-[11px] text-gray-500">
            دسترسی‌های دقیق را بعد از ساخت حساب، از دکمه‌ی «دسترسی‌ها» در فهرست پایین تنظیم کنید.
          </p>
        </section>
      )}

      {loading && <p className="text-sm text-gray-400">در حال بارگذاری...</p>}

      {!loading &&
        agents.map((agent) => (
          <section key={agent.id} className="mb-3 rounded border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenProfile(agent.id)}
                    className="text-sm font-bold text-primary-700 hover:underline"
                  >
                    {agent.fullName}
                  </button>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      agent.role === 'admin'
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {ROLE_LABELS[agent.role] ?? agent.role}
                  </span>
                  <span
                    className={`text-[10px] ${
                      agent.status === 'online' ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    ● {STATUS_LABELS[agent.status] ?? agent.status}
                  </span>
                  {agent.twoFactorEnabled && (
                    <span className="text-[10px] text-green-700">🔐 2FA فعال</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {agent.email}
                  {agent.phone ? ` · ${agent.phone}` : ''}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                <select
                  value={agent.role}
                  onChange={(e) => handleRoleChange(agent, e.target.value as 'admin' | 'agent')}
                  className="rounded border border-gray-300 p-1"
                >
                  <option value="agent">اپراتور</option>
                  <option value="admin">ادمین</option>
                </select>
                <button
                  onClick={() =>
                    setEditingPermissionsFor((prev) => (prev === agent.id ? null : agent.id))
                  }
                  className="text-primary-600"
                >
                  دسترسی‌ها
                  {agent.role !== 'admin' && (
                    <span className="mr-1 rounded bg-primary-100 px-1 text-[10px] text-primary-800">
                      {countGranted(agent)}
                    </span>
                  )}
                </button>
                <button onClick={() => handleDelete(agent)} className="text-red-600">
                  حذف
                </button>
              </div>
            </div>

            {editingPermissionsFor === agent.id && (
              <div className="mt-3 rounded bg-gray-50 p-3">
                {agent.role === 'admin' ? (
                  <p className="text-xs text-gray-600">
                    این حساب <strong>ادمین</strong> است و به‌صورت خودکار همه‌ی دسترسی‌ها را دارد.
                    برای محدود کردن، ابتدا نقش را به «اپراتور» تغییر دهید.
                  </p>
                ) : (
                  <>
                    <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
                      <span className="text-[11px] font-bold text-gray-600">الگوی آماده:</span>
                      {PERMISSION_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => handleApplyPreset(agent, preset.permissions)}
                          title={preset.description}
                          className="rounded border border-primary-200 bg-primary-50 px-2 py-1 text-[11px] text-primary-800 hover:bg-primary-100"
                        >
                          {preset.name}
                        </button>
                      ))}
                      <button
                        onClick={() => handleClearPermissions(agent)}
                        className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100"
                      >
                        پاک کردن همه
                      </button>
                    </div>

                    {PERMISSION_GROUPS.map((group) => (
                      <div key={group.title} className="mb-3">
                        <div className="mb-1.5 text-[11px] font-bold text-gray-700">
                          {group.title}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {group.permissions.map((permission) => (
                            <label
                              key={permission}
                              className="flex cursor-pointer items-start gap-2 rounded bg-white p-2 text-xs text-gray-700 hover:bg-primary-50"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={agent.permissions?.[permission] === true}
                                onChange={() => handlePermissionToggle(agent, permission)}
                              />
                              <span>
                                {PERMISSION_LABELS[permission]}
                                <span className="block text-[10px] text-gray-400">
                                  {PERMISSION_DESCRIPTIONS[permission]}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}

                    <p className="text-[10px] text-gray-500">
                      تغییرات بلافاصله ذخیره و اعمال می‌شوند — نیازی به خروج و ورود دوباره‌ی اپراتور نیست.
                      «مدیریت اپراتورها» عمداً قابل واگذاری نیست و همیشه فقط دست ادمین است.
                    </p>
                  </>
                )}
              </div>
            )}
          </section>
        ))}
    </div>
  );
}
