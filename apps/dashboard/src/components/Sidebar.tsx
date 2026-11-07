import type { ReactNode } from 'react';
import { MiraLogo } from './MiraLogo';

export type SidebarNavKey =
  'inbox' | 'visitors-online' | 'visitors-all' | 'reports' | 'agents' | 'settings';

interface SidebarProps {
  activeItem: SidebarNavKey | 'profile' | null;
  unreadCount: number;
  showVisitors: boolean;
  showReports: boolean;
  showAgents: boolean;
  profileName: string;
  profileRole: string;
  avatarUrl: string | null;
  onNavigate: (key: SidebarNavKey) => void;
  onOpenMyProfile: () => void;
  onLogout: () => void;
}

/* آیکون‌های خطی سبک — درون‌خطی تا وابستگی جدیدی اضافه نشود */
function IconChat() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5 shrink-0"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10.5h8M8 14h4m-6.7 5.3L3 21l1.2-3.6A8.5 8.5 0 1 1 7.6 20l-2.3-.7Z"
      />
    </svg>
  );
}
function IconPulse() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5 shrink-0"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2.5-6 4 12L16 12h5" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5 shrink-0"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 19a4 4 0 0 0-8 0m12 0a4 4 0 0 0-3-3.87M9 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm9-2.13a3 3 0 0 1 0 5.66M4 19a4 4 0 0 1 3-3.87m-1-9.26a3 3 0 0 0 0 5.66"
      />
    </svg>
  );
}
function IconChart() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5 shrink-0"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10m6 10V4m6 16v-7m4 7H2" />
    </svg>
  );
}
function IconTeam() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5 shrink-0"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 2c-4 0-7 2-7 4.5V20h14v-1.5c0-2.5-3-4.5-7-4.5Z"
      />
    </svg>
  );
}
function IconGear() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5 shrink-0"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.3 4.3a2 2 0 0 1 3.4 0l.5.9a2 2 0 0 0 2.2.9l1-.2a2 2 0 0 1 1.7 3l-.6.8a2 2 0 0 0 0 2.4l.6.8a2 2 0 0 1-1.7 3l-1-.2a2 2 0 0 0-2.2.9l-.5.9a2 2 0 0 1-3.4 0l-.5-.9a2 2 0 0 0-2.2-.9l-1 .2a2 2 0 0 1-1.7-3l.6-.8a2 2 0 0 0 0-2.4l-.6-.8a2 2 0 0 1 1.7-3l1 .2a2 2 0 0 0 2.2-.9l.5-.9Z"
      />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4 shrink-0"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5M10 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7"
      />
    </svg>
  );
}

interface NavItemProps {
  icon: ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}

function NavItem({ icon, label, active, badge, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title={label}
      className={`relative flex min-h-11 w-full items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-sm transition-colors md:justify-start md:px-3 ${
        active
          ? 'bg-primary-50 font-bold text-primary-700'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
      }`}
    >
      <span aria-hidden="true" className={active ? 'text-primary-600' : 'text-gray-500'}>
        {icon}
      </span>
      <span className="hidden flex-1 text-right md:block">{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute end-0 top-0 rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold text-[#172033] md:static">
          {Math.min(badge, 99).toLocaleString('fa-IR')}
        </span>
      )}
    </button>
  );
}

export function Sidebar({
  activeItem,
  unreadCount,
  showVisitors,
  showReports,
  showAgents,
  profileName,
  profileRole,
  avatarUrl,
  onNavigate,
  onOpenMyProfile,
  onLogout,
}: SidebarProps) {
  return (
    <aside className="flex w-16 shrink-0 flex-col border-l border-gray-200 bg-white md:w-52">
      {/* لوگو و نام برند */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-3 py-4 md:px-4">
        <MiraLogo size={36} animated />
        <div className="hidden leading-tight md:block">
          <div className="text-base font-extrabold text-primary-800">میرا</div>
          <div className="text-[11px] text-gray-400">داشبورد اپراتور</div>
        </div>
      </div>

      {/* ناوبری اصلی */}
      <nav aria-label="بخش‌های داشبورد" className="flex-1 space-y-1 overflow-y-auto p-2">
        <NavItem
          icon={<IconChat />}
          label="گفتگوها"
          active={activeItem === 'inbox'}
          badge={unreadCount}
          onClick={() => onNavigate('inbox')}
        />
        {showVisitors && (
          <NavItem
            icon={<IconPulse />}
            label="بازدیدکنندگان آنلاین"
            active={activeItem === 'visitors-online'}
            onClick={() => onNavigate('visitors-online')}
          />
        )}
        {showVisitors && (
          <NavItem
            icon={<IconUsers />}
            label="همه‌ی بازدیدکنندگان"
            active={activeItem === 'visitors-all'}
            onClick={() => onNavigate('visitors-all')}
          />
        )}
        {showReports && (
          <NavItem
            icon={<IconChart />}
            label="گزارش‌گیری"
            active={activeItem === 'reports'}
            onClick={() => onNavigate('reports')}
          />
        )}
        {/* مدیریت اپراتورها عمداً فقط ادمین است و به permission واگذار نمی‌شود */}
        {showAgents && (
          <NavItem
            icon={<IconTeam />}
            label="اپراتورها"
            active={activeItem === 'agents'}
            onClick={() => onNavigate('agents')}
          />
        )}
        {/* تنظیمات برای همه‌ی اپراتورها بازه — غیر-ادمین فقط 2FA حساب خودش رو می‌بینه */}
        <NavItem
          icon={<IconGear />}
          label="تنظیمات"
          active={activeItem === 'settings'}
          onClick={() => onNavigate('settings')}
        />
      </nav>

      {/* بلوک پروفایل اپراتور */}
      <div className="border-t border-gray-100 p-3">
        <div
          className={`flex flex-col items-center gap-2 rounded-lg p-0 transition-colors md:flex-row md:p-2 ${
            activeItem === 'profile' ? 'bg-primary-50' : 'hover:bg-gray-50'
          }`}
        >
          <button
            type="button"
            onClick={onOpenMyProfile}
            aria-label="پروفایل من"
            aria-current={activeItem === 'profile' ? 'page' : undefined}
            className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg text-right md:justify-start"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                width="36"
                height="36"
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white">
                {profileName ? profileName.charAt(0) : '؟'}
              </span>
            )}
            <span className="hidden min-w-0 md:block">
              <span className="block truncate text-sm font-medium text-gray-800">
                {profileName || '—'}
              </span>
              <span className="block text-[11px] text-gray-400">
                {profileRole === 'admin' ? 'مدیر' : 'اپراتور'}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            aria-label="خروج از این فروشگاه"
            title="خروج از این فروشگاه"
            className="grid min-h-11 min-w-11 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <IconLogout />
          </button>
        </div>
      </div>
    </aside>
  );
}
