import { useEffect, useState } from 'react';
import { estimateAiCost, type AiBillingDto, type AiUsageReport } from '@mira/shared-types';
import { apiClient } from '../api';

const number = (value: number | null | undefined, digits = 0) =>
  value == null ? '—' : value.toLocaleString('fa-IR', { maximumFractionDigits: digits });

export function AiBillingSection() {
  const [data, setData] = useState<AiBillingDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modelId, setModelId] = useState('');
  const [input, setInput] = useState(1500);
  const [output, setOutput] = useState(400);
  const [requests, setRequests] = useState(1000);
  const [search, setSearch] = useState('');
  const [days, setDays] = useState(7);
  const [usage, setUsage] = useState<AiUsageReport | null>(null);
  const [usageError, setUsageError] = useState('');

  async function refreshUsage(period: number): Promise<void> {
    setUsageError('');
    try {
      setUsage(await apiClient.getAiUsage(period));
    } catch {
      setUsageError('گزارش مصرف میرا دریافت نشد.');
    }
  }
  useEffect(() => {
    let active = true;
    setUsage(null);
    setUsageError('');
    apiClient
      .getAiUsage(days)
      .then((result) => {
        if (active) setUsage(result);
      })
      .catch(() => {
        if (active) setUsageError('گزارش مصرف میرا دریافت نشد.');
      });
    return () => {
      active = false;
    };
  }, [days]);

  async function refresh(): Promise<void> {
    setLoading(true);
    setError('');
    try {
      const result = await apiClient.getAiBilling();
      setData(result);
      setModelId((prev) =>
        result.models.some((m) => m.id === prev)
          ? prev
          : result.models.find((m) => m.id === 'deepseek-v4-flash')?.id ||
            result.models[0]?.id ||
            '',
      );
      await refreshUsage(days);
    } catch {
      setError('اطلاعات هزینه دریافت نشد؛ اتصال و دسترسی مدیریت را بررسی کنید.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  const model = data?.models.find((m) => m.id === modelId);
  const costUsd = model ? estimateAiCost(model, input, output, requests) : null;
  const costIrt =
    costUsd != null && data?.credit?.exchangeRate && data.credit.exchangeRate > 0
      ? costUsd * data.credit.exchangeRate
      : null;
  const modelOptions =
    data?.models.filter((m) => m.id.toLowerCase().includes(search.toLowerCase())) ?? [];
  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100';

  return (
    <section
      aria-label="هزینه و اعتبار آوالای"
      className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div>
          <h2 className="font-bold text-slate-900">هزینه و اعتبار آوالای</h2>
          <p className="mt-1 text-xs text-slate-500">موجودی، مصرف حساب و برآورد هزینه مدل‌ها</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 disabled:opacity-50"
          >
            {loading ? 'در حال دریافت…' : 'به‌روزرسانی'}
          </button>
          <a
            href="https://chat.avalai.ir/platform/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white"
          >
            شارژ و پرداخت سریع ↗
          </a>
        </div>
      </header>
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800">مصرف کاربران میرا</h3>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            بازه گزارش
            <select
              value={days}
              disabled={loading}
              onChange={(event) => setDays(Number(event.target.value))}
              className="rounded-lg border border-slate-200 bg-white p-2"
            >
              <option value={1}>۲۴ ساعت اخیر</option>
              <option value={7}>۷ روز اخیر</option>
              <option value={30}>۳۰ روز اخیر</option>
            </select>
          </label>
        </div>
        {usageError && (
          <p role="alert" className="text-xs text-red-600">
            {usageError}
          </p>
        )}
        {usage && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="کل توکن‌های ثبت‌شده" value={number(usage.totalTokens)} />
              <Metric label="کاربران دارای مصرف" value={number(usage.users)} />
              <Metric label="میانگین توکن هر کاربر" value={number(usage.averageTokensPerUser, 1)} />
              <Metric
                label="هزینه نهایی‌شده میرا"
                value={usage.recordedCostUsd == null ? '—' : `$${number(usage.recordedCostUsd, 6)}`}
              />
            </div>
            <p className="text-[11px] leading-6 text-slate-500">
              {number(usage.requests)} درخواست، {number(usage.failedRequests)} ناموفق و{' '}
              {number(usage.pendingCosts)} هزینه در انتظار محاسبه. مصرف هر کاربر شامل پاسخ، پیشنهاد
              اپراتور، خلاصه و بازیابی منابع گفتگوهای اوست. ساخت نمایه اسناد فقط در مصرف کل حساب
              می‌شود. میانگین بر اساس تمام کاربران دارای مصرف در این بازه است. ثبت مصرف از زمان نصب
              این نسخه شروع می‌شود؛ هزینه نهایی از تراکنش آوالای دریافت می‌شود.
            </p>
            {usage.unknownRequests > 0 && (
              <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                تعداد توکن {number(usage.unknownRequests)} درخواست از سرویس دریافت نشده است؛ مجموع
                توکن‌ها ناقص است و میانگین کاربران مرتبط محاسبه نمی‌شود.
              </p>
            )}
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full min-w-[620px] text-right text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {[
                      'کاربر',
                      'درخواست',
                      'توکن ورودی',
                      'توکن خروجی',
                      'کل توکن',
                      'هزینه نهایی‌شده',
                    ].map((label) => (
                      <th key={label} className="p-3 font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usage.visitors.map((visitor) => (
                    <tr key={visitor.id} className="border-t border-slate-100 text-slate-700">
                      <td className="p-3">
                        <span className="block font-medium">{visitor.name}</span>
                        <span dir="ltr" className="mt-1 block text-[10px] text-slate-400">
                          {visitor.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="p-3">{number(visitor.requests)}</td>
                      <td className="p-3">{number(visitor.inputTokens)}</td>
                      <td className="p-3">{number(visitor.outputTokens)}</td>
                      <td className="p-3">{number(visitor.totalTokens)}</td>
                      <td className="p-3">
                        {visitor.costUsd == null ? '—' : `$${number(visitor.costUsd, 6)}`}
                        {visitor.pendingCosts > 0 && (
                          <span className="mt-1 block text-[10px] text-amber-700">
                            {number(visitor.pendingCosts)} در انتظار
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!usage.visitors.length && (
                <p className="p-5 text-center text-xs text-slate-500">
                  هنوز مصرفی برای کاربران در این بازه ثبت نشده است.
                </p>
              )}
            </div>
            {usage.users > 100 && (
              <p className="text-xs text-slate-500">
                ۱۰۰ کاربر با بیشترین مصرف نمایش داده می‌شوند؛ آمار کل شامل تمام کاربران است.
              </p>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
        {data && !data.configured && (
          <p className="rounded-xl bg-blue-50 p-4 text-xs leading-7 text-blue-800">
            اتصال حساب آوالای برای این سایت هنوز روی سرور تنظیم نشده است. پس از ثبت کلید و اتصال
            حساب به این سایت، موجودی و تعرفه‌ها اینجا نمایش داده می‌شوند.
          </p>
        )}
        {data?.warnings.map((warning) => (
          <p
            key={warning}
            role="status"
            className="rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-800"
          >
            {warning}
          </p>
        ))}
        {data?.configured && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="موجودی کیف پول" value={`${number(data.credit?.remainingIrt)} تومان`} />
              <Metric
                label="هزینه کل حساب · ۲۴ ساعت"
                value={data.usage?.costUsd == null ? '—' : `$${number(data.usage.costUsd, 6)}`}
              />
              <Metric label="درخواست‌های حساب · ۲۴ ساعت" value={number(data.usage?.requests)} />
            </div>
            <p className="text-[11px] leading-6 text-slate-500">
              این آمار کل حساب آوالای است و می‌تواند مصرف برنامه‌های دیگر را هم شامل شود. اطلاعات تا
              دو دقیقه کش می‌شود. پرداخت در صفحه رسمی آوالای تکمیل می‌شود.
            </p>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800">برآورد هزینه گفتگو</h3>
                <label className="block text-xs text-slate-600">
                  جستجوی مدل
                  <input
                    className={`${inputClass} mt-2`}
                    dir="ltr"
                    placeholder="luna / deepseek"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-slate-600">
                  مدل برای برآورد
                  <select
                    className={`${inputClass} mt-2`}
                    dir="ltr"
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    disabled={!data.models.length}
                  >
                    {model && !modelOptions.some((m) => m.id === modelId) && (
                      <option value={modelId}>{modelId}</option>
                    )}
                    {modelOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Numeric label="توکن ورودی هر درخواست" value={input} onChange={setInput} />
                  <Numeric label="توکن خروجی هر درخواست" value={output} onChange={setOutput} />
                  <Numeric label="تعداد درخواست" value={requests} onChange={setRequests} />
                </div>
                <p className="text-[11px] leading-6 text-slate-500">
                  ورودی، متن گفتگو و منابع بازیابی‌شده را هم شامل می‌شود. این برآورد برای متن و بدون
                  تخفیف کش، بسته اعتباری و هزینه ابزارهاست؛ صورتحساب آوالای مبلغ نهایی را تعیین
                  می‌کند.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900 p-5 text-white">
                <p className="text-xs text-slate-300">هزینه تخمینی</p>
                <div className="mt-3 text-2xl font-bold" dir="ltr">
                  {costUsd == null ? '—' : `$${number(costUsd, 6)}`}
                </div>
                <div className="mt-2 text-sm text-teal-300">
                  {costIrt == null ? 'نرخ تبدیل در دسترس نیست' : `${number(costIrt)} تومان`}
                </div>
                <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-[11px] leading-6 text-slate-300">
                  <p>هر یک میلیون توکن ورودی: {model ? `$${model.inputPerMillion}` : '—'}</p>
                  <p>هر یک میلیون توکن خروجی: {model ? `$${model.outputPerMillion}` : '—'}</p>
                  <p>تعرفه پایه زنده از آوالای؛ نرخ ورودی بلند در برآورد اعمال می‌شود.</p>
                </div>
              </div>
            </div>
            {!!data.usage?.models.length && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-3">مدل مصرف‌شده</th>
                      <th className="p-3">درخواست</th>
                      <th className="p-3">توکن</th>
                      <th className="p-3">هزینه دلاری</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.usage.models.map((m) => (
                      <tr key={m.id} className="border-t border-slate-100">
                        <td className="p-3 font-mono" dir="ltr">
                          {m.id}
                        </td>
                        <td className="p-3">{number(m.requests)}</td>
                        <td className="p-3">{number(m.tokens)}</td>
                        <td className="p-3">{number(m.costUsd, 6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="text-[10px] text-slate-400">
              آخرین بررسی: {new Date(data.checkedAt).toLocaleString('fa-IR')}
            </div>
          </>
        )}
        <p className="text-[11px] text-slate-400">
          برای شارژ، با حساب خود وارد آوالای شوید و مبلغ را در درگاه رسمی انتخاب کنید.
        </p>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-3 text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}
function Numeric({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block text-[11px] text-slate-600">
      {label}
      <input
        type="number"
        min={0}
        max={1_000_000_000}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />
    </label>
  );
}
