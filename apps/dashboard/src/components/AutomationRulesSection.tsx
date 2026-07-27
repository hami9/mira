import { useEffect, useState } from 'react';
import type { AutomationActionType, AutomationRuleDto } from '@mira/shared-types';
import { apiClient } from '../api';

const ACTION_LABELS: Record<AutomationActionType, string> = {
  set_department: 'انتقال به دپارتمان',
  add_tag: 'افزودن برچسب',
  set_priority_high: 'تعیین اولویت بالا',
};

export function AutomationRulesSection() {
  const [rules, setRules] = useState<AutomationRuleDto[]>([]);
  const [name, setName] = useState('');
  const [triggerValue, setTriggerValue] = useState('');
  const [actionType, setActionType] = useState<AutomationActionType>('set_department');
  const [actionValue, setActionValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.listAutomationRules().then(setRules);
  }, []);

  const actionValueNeeded = actionType !== 'set_priority_high';

  async function handleAdd(): Promise<void> {
    if (!name.trim() || !triggerValue.trim()) return;
    if (actionValueNeeded && !actionValue.trim()) return;
    setSaving(true);
    try {
      const created = await apiClient.createAutomationRule({
        name: name.trim(),
        triggerValue: triggerValue.trim(),
        actionType,
        actionValue: actionValueNeeded ? actionValue.trim() : null,
      });
      setRules((prev) => [...prev, created]);
      setName('');
      setTriggerValue('');
      setActionValue('');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: AutomationRuleDto): Promise<void> {
    const updated = await apiClient.updateAutomationRule(rule.id, { enabled: !rule.enabled });
    setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function handleDelete(id: string): Promise<void> {
    await apiClient.deleteAutomationRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <section className="mb-6 rounded border border-gray-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-bold text-gray-700">قوانین اتوماسیون</h2>
      <p className="mb-3 text-xs text-gray-500">
        اگر پیام بازدیدکننده یکی از کلیدواژه‌ها را داشته باشد، اکشن انتخابی خودکار روی مکالمه اجرا
        می‌شود.
      </p>

      {rules.length === 0 && <p className="mb-3 text-xs text-gray-400">قانونی تعریف نشده است.</p>}
      {rules.map((rule) => (
        <div
          key={rule.id}
          className="mb-2 flex items-start justify-between border-b border-gray-100 pb-2 text-xs"
        >
          <div>
            <div className="font-medium text-gray-800">
              {rule.name}
              {!rule.enabled && <span className="mr-2 text-gray-400">(غیرفعال)</span>}
            </div>
            <div className="text-gray-500">
              اگر پیام شامل: <span className="font-mono">{rule.triggerValue}</span> ←{' '}
              {ACTION_LABELS[rule.actionType]}
              {rule.actionValue ? `: ${rule.actionValue}` : ''}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => handleToggle(rule)} className="text-primary-600">
              {rule.enabled ? 'غیرفعال' : 'فعال'}
            </button>
            <button onClick={() => handleDelete(rule.id)} className="text-red-600">
              حذف
            </button>
          </div>
        </div>
      ))}

      <div className="mt-3 space-y-2 rounded bg-gray-50 p-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="نام قانون (مثلاً «مسیریابی سوالات گارانتی»)"
          className="w-full rounded border border-gray-300 p-1.5 text-xs"
        />
        <input
          value={triggerValue}
          onChange={(e) => setTriggerValue(e.target.value)}
          placeholder="کلیدواژه‌ها با کاما (مثلاً: گارانتی، مرجوعی، تعمیر)"
          className="w-full rounded border border-gray-300 p-1.5 text-xs"
        />
        <div className="flex gap-2">
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value as AutomationActionType)}
            className="rounded border border-gray-300 p-1.5 text-xs"
          >
            <option value="set_department">انتقال به دپارتمان</option>
            <option value="add_tag">افزودن برچسب</option>
            <option value="set_priority_high">تعیین اولویت بالا</option>
          </select>
          {actionValueNeeded && (
            <input
              value={actionValue}
              onChange={(e) => setActionValue(e.target.value)}
              placeholder={actionType === 'set_department' ? 'نام دپارتمان' : 'نام برچسب'}
              className="flex-1 rounded border border-gray-300 p-1.5 text-xs"
            />
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="rounded-lg bg-primary-600 transition-colors hover:bg-primary-700 px-3 py-1.5 text-xs text-white disabled:opacity-60"
        >
          {saving ? 'در حال افزودن...' : 'افزودن قانون'}
        </button>
      </div>
    </section>
  );
}
