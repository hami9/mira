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

  async function saveDetails(): Promise<void> {
    setSaving(true);
    setDetailsError('');
    try {
      const tags = [
        ...new Set(
          tagsInput
            .split(/[,،]/)
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ];
      const updated = await apiClient.updateConversation(conversation.id, {
        department: department.trim() || null,
        tags,
      });
      onUpdated(updated);
    } catch {
      setDetailsError('ذخیره جزئیات انجام نشد؛ دوباره تلاش کنید.');
    } finally {
      setSaving(false);
    }
  }

  async function resolve(): Promise<void> {
    try {
      const updated = await apiClient.resolveConversation(conversation.id);
      onUpdated(updated);
    } catch {
      setDetailsError('بستن گفتگو انجام نشد؛ دسترسی و اتصال را بررسی کنید.');
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
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs">
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
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {controlBusy ? 'در حال تغییر…' : aiActive ? 'تحویل به پشتیبان' : 'بازگردانی به AI'}
          </button>
        )}
        <span className="text-[10px] text-slate-400">
          مشاهدهٔ گفتگو AI را متوقف نمی‌کند؛ ارسال پاسخ، گفتگو را به شما می‌سپارد.
        </span>
        {controlError && (
          <span role="alert" className="text-red-600">
            {controlError}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 p-2 text-xs">
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          onBlur={saveDetails}
          placeholder="دپارتمان"
          aria-label="دپارتمان گفتگو"
          className="w-28 rounded border border-gray-300 p-1"
        />
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          onBlur={saveDetails}
          placeholder="برچسب‌ها (با ، یا , جدا کنید)"
          aria-label="برچسب‌های گفتگو"
          className="w-40 rounded border border-gray-300 p-1"
        />
        {saving && <span className="text-gray-400">در حال ذخیره...</span>}
        <label className="flex items-center gap-2">
          اولویت گفتگو
          <select
            aria-label="اولویت گفتگو"
            value={conversation.priority}
            disabled={saving}
            onChange={(event) => void setPriority(event.target.value as 'normal' | 'high')}
            className="min-h-10 rounded-xl border border-slate-200 px-2"
          >
            <option value="normal">عادی</option>
            <option value="high">فوری</option>
          </select>
        </label>
        {canResolve && (
          <button
            onClick={resolve}
            disabled={isResolved}
            className="mr-auto rounded bg-green-600 px-3 py-1 text-white disabled:bg-gray-300"
          >
            {isResolved ? 'حل‌شده' : 'حل مکالمه'}
          </button>
        )}
      </div>
      <div className="px-3 pb-2">
        <TagChips tags={conversation.tags} />
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
