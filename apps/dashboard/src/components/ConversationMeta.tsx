import { useEffect, useState } from 'react';
import { ConversationStatus } from '@mira/shared-types';
import { ConversationDto } from '../api';
import { useApiClient } from '../api-context';
import { TagChips } from './VisitorLabels';

interface ConversationMetaProps {
  conversation: ConversationDto;
  onUpdated: (conversation: ConversationDto) => void;
  canResolve?: boolean;
}

export function ConversationMeta({
  conversation,
  onUpdated,
  canResolve = false,
}: ConversationMetaProps) {
  const apiClient = useApiClient();
  const [department, setDepartment] = useState(conversation.department ?? '');
  const [tagsInput, setTagsInput] = useState(conversation.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [controlBusy, setControlBusy] = useState(false);
  const [controlError, setControlError] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const [detailsNotice, setDetailsNotice] = useState('');
  const [resolving, setResolving] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  useEffect(() => {
    setDepartment(conversation.department ?? '');
    setTagsInput(conversation.tags.join('، '));
  }, [conversation.id, conversation.department, conversation.tags.join('\n')]);
  useEffect(() => {
    let mounted = true;
    apiClient
      .getSiteSettings()
      .then((site) => {
        if (mounted) setAiEnabled(site.aiEnabled);
      })
      .catch(() => {
        if (mounted) setControlError('بررسی وضعیت دستیار انجام نشد.');
      });
    return () => {
      mounted = false;
    };
  }, [apiClient]);
  const aiActive =
    aiEnabled === true &&
    !conversation.aiPaused &&
    !conversation.assignedAgentId &&
    conversation.status === ConversationStatus.OPEN;

  async function changeControl() {
    setControlBusy(true);
    setControlError('');
    try {
      const updated = aiActive
        ? await apiClient.assignConversation(conversation.id)
        : await apiClient.resumeConversationAi(conversation.id);
      onUpdated(updated);
    } catch {
      setControlError('تغییر کنترل انجام نشد؛ دسترسی و وضعیت گفتگو را بررسی کنید.');
    } finally {
      setControlBusy(false);
    }
  }

  const tags = [
    ...new Set(
      tagsInput
        .split(/[,،]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
  const detailsChanged =
    department.trim() !== (conversation.department ?? '') ||
    JSON.stringify(tags) !== JSON.stringify(conversation.tags);

  async function saveDetails(): Promise<void> {
    if (saving || !detailsChanged) return;
    setSaving(true);
    setDetailsError('');
    setDetailsNotice('');
    try {
      const updated = await apiClient.updateConversation(conversation.id, {
        department: department.trim() || null,
        tags,
      });
      onUpdated(updated);
      setDetailsNotice('جزئیات گفتگو ذخیره شد.');
    } catch {
      setDetailsError('ذخیره جزئیات انجام نشد؛ دوباره تلاش کنید.');
    } finally {
      setSaving(false);
    }
  }

  async function resolve(): Promise<void> {
    setResolving(true);
    setDetailsError('');
    try {
      const updated = await apiClient.resolveConversation(conversation.id);
      onUpdated(updated);
    } catch {
      setDetailsError('بستن گفتگو انجام نشد؛ دسترسی و اتصال را بررسی کنید.');
    } finally {
      setResolving(false);
    }
  }
  async function setPriority(priority: 'normal' | 'high') {
    setDetailsError('');
    setSaving(true);
    try {
      onUpdated(await apiClient.updateConversation(conversation.id, { priority }));
    } catch {
      setDetailsError('تغییر اولویت انجام نشد؛ دوباره تلاش کنید.');
    } finally {
      setSaving(false);
    }
  }

  const isResolved = conversation.status === ConversationStatus.RESOLVED;

  return (
    <div className="border-b border-gray-200 bg-white">
      <div
        role="group"
        aria-label="وضعیت و تنظیمات گفتگو"
        className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs"
      >
        <span
          className={`rounded-full px-3 py-1.5 ${aiActive ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'}`}
          role="status"
          aria-label="کنترل پاسخ‌گویی"
        >
          {isResolved
            ? 'گفتگو بسته شده'
            : aiEnabled === null
              ? 'بررسی وضعیت AI…'
              : !aiEnabled
                ? 'AI فروشگاه خاموش است'
                : aiActive
                  ? '✦ هوش مصنوعی فعال'
                  : 'پشتیبان انسانی · AI متوقف است'}
        </span>
        {!isResolved && (
          <button
            type="button"
            disabled={controlBusy || aiEnabled !== true}
            onClick={() => void changeControl()}
            className="control-button"
          >
            {controlBusy ? 'در حال تغییر…' : aiActive ? 'تحویل به پشتیبان' : 'بازگردانی به AI'}
          </button>
        )}
        {controlError && (
          <span role="alert" className="text-red-600">
            {controlError}
          </span>
        )}
        <label className="flex items-center gap-2">
          اولویت گفتگو
          <select
            aria-label="اولویت گفتگو"
            value={conversation.priority}
            disabled={saving}
            onChange={(event) => void setPriority(event.target.value as 'normal' | 'high')}
            className="text-xs"
          >
            <option value="normal">عادی</option>
            <option value="high">فوری</option>
          </select>
        </label>
        {canResolve && (
          <button
            type="button"
            onClick={resolve}
            disabled={isResolved || resolving}
            className="control-button"
          >
            {resolving ? 'در حال بستن…' : isResolved ? 'حل‌شده' : 'حل مکالمه'}
          </button>
        )}
        <button
          type="button"
          aria-expanded={editingDetails}
          aria-controls={`conversation-details-${conversation.id}`}
          className="control-button"
          onClick={() => setEditingDetails((current) => !current)}
        >
          جزئیات و برچسب‌ها
          {detailsChanged && <span className="text-amber-700">ذخیره نشده</span>}
        </button>
      </div>
      <div
        id={`conversation-details-${conversation.id}`}
        hidden={!editingDetails}
        className="px-3 pb-2 text-xs"
      >
        <form
          className="mt-2 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void saveDetails();
          }}
        >
          <label className="block text-slate-600">
            دپارتمان گفتگو
            <input
              value={department}
              onChange={(event) => {
                setDepartment(event.target.value);
                setDetailsNotice('');
              }}
              disabled={saving}
              placeholder="مثلاً فروش…"
              className="input-base mt-1 min-h-11 w-full bg-white px-3"
            />
          </label>
          <label className="block text-slate-600">
            برچسب‌های گفتگو
            <input
              value={tagsInput}
              onChange={(event) => {
                setTagsInput(event.target.value);
                setDetailsNotice('');
              }}
              disabled={saving}
              placeholder="مثلاً ارسال، پیگیری…"
              className="input-base mt-1 min-h-11 w-full bg-white px-3"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={saving || !detailsChanged}
              className="control-button control-button-primary"
            >
              {saving ? 'در حال ذخیره…' : 'ذخیره جزئیات'}
            </button>
            <p role="status" className="text-teal-700">
              {detailsNotice}
            </p>
            <TagChips tags={conversation.tags} />
          </div>
        </form>
      </div>
      {detailsError && (
        <p role="alert" className="px-3 pb-2 text-xs text-red-700">
          {detailsError}
        </p>
      )}
      {conversation.summary && (
        <div className="border-t border-gray-100 bg-teal-50 px-2 py-1 text-xs text-teal-800">
          ✨ خلاصه: {conversation.summary}
        </div>
      )}
    </div>
  );
}
