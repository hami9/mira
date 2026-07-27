import { useEffect, useState } from 'react';
import type { VisitorProfileDto } from '@mira/shared-types';
import { apiClient } from '../api';

interface VisitorProfilePageProps {
  visitorId: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  open: 'باز',
  pending: 'در حال بررسی',
  resolved: 'حل‌شده',
};

export function VisitorProfilePage({ visitorId, onClose }: VisitorProfilePageProps) {
  const [profile, setProfile] = useState<VisitorProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfile(null);
    apiClient
      .getVisitorProfile(visitorId)
      .then(setProfile)
      .catch(() => setError('دریافت پروفایل بازدیدکننده با خطا مواجه شد'));
  }, [visitorId]);

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <button onClick={onClose} className="mb-4 text-sm text-primary-600">
          بازگشت
        </button>
        <p className="text-sm text-gray-400">{error ?? 'در حال بارگذاری...'}</p>
      </div>
    );
  }

  const displayName =
    profile.name || profile.email || `مهمان ${profile.visitorRef.slice(0, 8)}`;

  return (
    <div className="mx-auto max-w-3xl overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">پروفایل بازدیدکننده</h1>
        <button onClick={onClose} className="text-sm text-primary-600">
          بازگشت
        </button>
      </div>

      <section className="mb-4 rounded border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-600">
            {displayName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-gray-800">{displayName}</span>
              <span className={`text-xs ${profile.isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                ● {profile.isOnline ? 'آنلاین' : 'آفلاین'}
              </span>
            </div>
            {profile.email && <div className="text-xs text-gray-500">{profile.email}</div>}
            <div className="font-mono text-[10px] text-gray-400">{profile.visitorRef}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-xs text-gray-700 sm:grid-cols-2">
          <div>مرورگر: {profile.browser ?? 'نامشخص'}</div>
          <div>سیستم‌عامل: {profile.os ?? 'نامشخص'}</div>
          <div>دستگاه: {profile.deviceType ?? 'desktop'}</div>
          <div>اولین بازدید: {new Date(profile.firstSeenAt).toLocaleString('fa-IR')}</div>
          <div>آخرین فعالیت: {new Date(profile.lastSeenAt).toLocaleString('fa-IR')}</div>
        </div>
      </section>

      <section className="mb-4 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-gray-700">
          تاریخچه‌ی گفتگوها ({profile.conversations.length})
        </h2>
        {profile.conversations.length === 0 ? (
          <p className="text-xs text-gray-400">این بازدیدکننده هنوز گفتگویی نداشته است.</p>
        ) : (
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2">تاریخ</th>
                <th className="pb-2">وضعیت</th>
                <th className="pb-2">دپارتمان</th>
                <th className="pb-2">پیام‌ها</th>
                <th className="pb-2">CSAT</th>
              </tr>
            </thead>
            <tbody>
              {profile.conversations.map((conversation) => (
                <tr key={conversation.id} className="border-b border-gray-100">
                  <td className="py-1.5">
                    {new Date(conversation.createdAt).toLocaleDateString('fa-IR')}
                  </td>
                  <td className="py-1.5">
                    {STATUS_LABELS[conversation.status] ?? conversation.status}
                    {conversation.priority === 'high' && (
                      <span className="mr-1 text-red-600">⚠ فوری</span>
                    )}
                  </td>
                  <td className="py-1.5">{conversation.department ?? '—'}</td>
                  <td className="py-1.5">{conversation.messageCount}</td>
                  <td className="py-1.5">
                    {conversation.csatScore !== null ? `${conversation.csatScore} / ۵` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-gray-700">
          صفحات بازدیدشده ({profile.pageViews.length})
        </h2>
        {profile.pageViews.length === 0 ? (
          <p className="text-xs text-gray-400">صفحه‌ای ثبت نشده است.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {profile.pageViews.map((pageView, index) => (
              <li key={index} className="flex justify-between gap-3 border-b border-gray-100 pb-1">
                <span className="truncate text-gray-700" title={pageView.url}>
                  {pageView.title || pageView.url}
                </span>
                <span className="shrink-0 text-gray-400">
                  {new Date(pageView.visitedAt).toLocaleString('fa-IR')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
