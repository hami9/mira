import { useEffect, useState } from 'react';
import type { AgentPerformanceDto, ReportsOverviewDto } from '@mira/shared-types';
import { apiClient } from '../api';

interface ReportsPageProps {
  onClose: () => void;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultFrom(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return isoDate(date);
}

export function ReportsPage({ onClose }: ReportsPageProps) {
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(isoDate(new Date()));
  const [overview, setOverview] = useState<ReportsOverviewDto | null>(null);
  const [agents, setAgents] = useState<AgentPerformanceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([apiClient.getReportsOverview(from, to), apiClient.getAgentPerformance(from, to)])
      .then(([overviewData, agentsData]) => {
        setOverview(overviewData);
        setAgents(agentsData);
      })
      .finally(() => setLoading(false));
  }, [from, to]);

  async function handleExport(): Promise<void> {
    setExporting(true);
    try {
      await apiClient.downloadReportsCsv(from, to);
    } finally {
      setExporting(false);
    }
  }

  const maxDailyCount = Math.max(1, ...(overview?.dailyCounts.map((d) => d.count) ?? [1]));

  return (
    <div className="mx-auto max-w-3xl overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">گزارش‌گیری</h1>
        <button onClick={onClose} className="text-sm text-blue-600">
          بازگشت به داشبورد
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white p-3 text-xs">
        <div>
          <label className="mb-1 block text-gray-600">از تاریخ</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border border-gray-300 p-1.5"
          />
        </div>
        <div>
          <label className="mb-1 block text-gray-600">تا تاریخ</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border border-gray-300 p-1.5"
          />
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="mr-auto rounded bg-green-600 px-3 py-1.5 text-white disabled:opacity-60"
        >
          {exporting ? 'در حال آماده‌سازی...' : '⬇️ خروجی CSV عملکرد اپراتورها'}
        </button>
      </div>

      {loading && <p className="text-sm text-gray-400">در حال بارگذاری گزارش...</p>}

      {!loading && overview && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="تعداد گفتگو" value={overview.totalConversations.toLocaleString('fa-IR')} />
            <StatCard
              label="میانگین اولین پاسخ"
              value={
                overview.avgFirstResponseMinutes !== null
                  ? `${overview.avgFirstResponseMinutes.toFixed(1)} دقیقه`
                  : '—'
              }
            />
            <StatCard
              label="میانگین امتیاز CSAT"
              value={overview.csat.average !== null ? `${overview.csat.average.toFixed(2)} / ۵` : '—'}
            />
            <StatCard
              label="رضایت مثبت (۴-۵ ستاره)"
              value={
                overview.csat.positivePercent !== null
                  ? `${overview.csat.positivePercent.toFixed(0)}٪ (${overview.csat.totalRatings} امتیاز)`
                  : '—'
              }
            />
          </div>

          <div className="mb-4 rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-bold text-gray-700">تعداد گفتگوی روزانه</h2>
            {overview.dailyCounts.length === 0 ? (
              <p className="text-xs text-gray-400">در این بازه‌ی زمانی گفتگویی ثبت نشده است.</p>
            ) : (
              <div className="flex h-32 items-end gap-1 overflow-x-auto">
                {overview.dailyCounts.map((day) => (
                  <div key={day.date} className="flex flex-col items-center" title={`${day.date}: ${day.count}`}>
                    <div
                      className="w-4 rounded-t bg-blue-500"
                      style={{ height: `${Math.max(4, (day.count / maxDailyCount) * 100)}px` }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-bold text-gray-700">عملکرد اپراتورها</h2>
            {agents.length === 0 ? (
              <p className="text-xs text-gray-400">داده‌ای برای نمایش وجود ندارد.</p>
            ) : (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="pb-2">اپراتور</th>
                    <th className="pb-2">گفتگوی رسیدگی‌شده</th>
                    <th className="pb-2">میانگین اولین پاسخ</th>
                    <th className="pb-2">میانگین CSAT</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.agentId} className="border-b border-gray-100">
                      <td className="py-1.5 font-medium text-gray-800">{agent.agentName}</td>
                      <td className="py-1.5">{agent.conversationsHandled}</td>
                      <td className="py-1.5">
                        {agent.avgFirstResponseMinutes !== null
                          ? `${agent.avgFirstResponseMinutes.toFixed(1)} دقیقه`
                          : '—'}
                      </td>
                      <td className="py-1.5">
                        {agent.avgCsatScore !== null ? agent.avgCsatScore.toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-gray-800">{value}</div>
    </div>
  );
}
