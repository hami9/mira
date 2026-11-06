import { ConversationDto, ListConversationsParams } from '../api';
import { conversationName, ModerationBadges, TagChips, VisitorFlags } from './VisitorLabels';

interface ConversationListProps {
  siteName: string;
  conversations: ConversationDto[];
  selectedId: string | null;
  filters: ListConversationsParams;
  onFiltersChange: (filters: ListConversationsParams) => void;
  onSelect: (conversation: ConversationDto) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  canDelete?: boolean;
  restoring?: boolean;
  onRestore?: (conversation: ConversationDto) => void;
}

const STATUS_LABELS: Record<string, string> = {
  open: 'باز',
  pending: 'در انتظار',
  resolved: 'حل‌شده',
};

function ConversationRow({
  conversation,
  selected,
  onSelect,
}: {
  conversation: ConversationDto;
  selected: boolean;
  onSelect: (conversation: ConversationDto) => void;
}) {
  const hasUnread = conversation.unreadCount > 0;
  const isUrgent = conversation.priority === 'high';
  return (
    <button
      data-conversation-id={conversation.id}
      onClick={() => onSelect(conversation)}
      className={`flex w-full items-start justify-between border-b border-gray-100 p-3 text-right text-sm transition-colors hover:bg-gray-50 ${
        selected ? 'bg-primary-50 hover:bg-primary-50' : ''
      } ${isUrgent ? 'border-r-4 border-r-red-500' : ''}`}
    >
      <div>
        <div className={hasUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}>
          {isUrgent && (
            <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-800">
              فوری
            </span>
          )}
          {conversationName(conversation)}
        </div>
        <div className="mt-2 space-y-1">
          <VisitorFlags flags={conversation.visitorFlags} />
          <ModerationBadges moderation={conversation.visitorModeration} />
          <TagChips tags={conversation.tags} />
        </div>
        <div className="text-xs text-gray-500">
          وضعیت: {STATUS_LABELS[conversation.status] ?? conversation.status}
          {conversation.department ? ` · ${conversation.department}` : ''}
        </div>
      </div>
      {hasUnread && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1.5 text-[11px] font-bold text-white">
          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
        </span>
      )}
    </button>
  );
}

export function ConversationList({
  siteName,
  conversations,
  selectedId,
  filters,
  onFiltersChange,
  onSelect,
  loading = false,
  error = '',
  onRetry,
  canDelete = false,
  restoring = false,
  onRestore,
}: ConversationListProps) {
  const byUrgencyThenOrder = (a: ConversationDto, b: ConversationDto) =>
    a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1;
  const unanswered = conversations.filter((c) => c.unreadCount > 0).sort(byUrgencyThenOrder);
  const answered = conversations.filter((c) => c.unreadCount === 0).sort(byUrgencyThenOrder);

  return (
    <div className="flex w-full flex-col overflow-hidden border-l border-gray-200 bg-white sm:w-72">
      <div className="border-b border-gray-100 px-4 py-4 text-base font-bold tracking-tight text-gray-800">
        مکالمات ({conversations.length})
        <div className="mt-1 truncate text-xs font-normal text-primary-600">{siteName}</div>
      </div>
      <div className="space-y-2 border-b border-gray-200 p-2">
        {canDelete && (
          <label className="block text-[10px] text-slate-500">
            پوشه گفتگو
            <select
              aria-label="پوشه گفتگو"
              value={filters.deleted === 'only' ? 'trash' : 'inbox'}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  deleted: event.target.value === 'trash' ? 'only' : undefined,
                })
              }
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs"
            >
              <option value="inbox">گفتگوهای فعال</option>
              <option value="trash">زباله‌دان</option>
            </select>
          </label>
        )}
        <input
          value={filters.search ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
          placeholder="جست‌وجوی نام، ایمیل یا دپارتمان..."
          aria-label="جست‌وجوی گفتگوها"
          className="input-base w-full rounded-lg bg-gray-50 p-2.5 text-xs"
        />
        <div className="flex gap-2">
          <select
            value={filters.status ?? ''}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value || undefined })}
            className="w-full rounded border border-gray-300 p-1.5 text-xs"
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="open">باز</option>
            <option value="pending">در انتظار</option>
            <option value="resolved">حل‌شده</option>
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p role="status" className="p-3 text-xs text-slate-500">
            در حال دریافت گفتگوها…
          </p>
        )}
        {error && (
          <div role="alert" className="p-3 text-xs text-red-700">
            {error}
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 block min-h-11 rounded-lg border px-3"
            >
              تلاش دوباره
            </button>
          </div>
        )}
        {!loading && !error && conversations.length === 0 && (
          <p className="p-3 text-sm text-gray-400">مکالمه‌ای پیدا نشد</p>
        )}

        {filters.deleted === 'only' ? (
          <>
            <p className="border-b border-slate-100 p-3 text-[11px] leading-6 text-slate-500">
              گفتگوهای این بخش قابل بازگردانی هستند. برای مشاهده پیام‌ها، ابتدا گفتگو را بازگردانید.
            </p>
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                data-conversation-id={conversation.id}
                className="border-b border-slate-100 p-3"
              >
                <div className="text-sm font-bold text-slate-800">
                  {conversationName(conversation)}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  انتقال به زباله‌دان:{' '}
                  {conversation.deletedAt
                    ? new Date(conversation.deletedAt).toLocaleString('fa-IR')
                    : '—'}
                </div>
                <button
                  type="button"
                  disabled={restoring}
                  onClick={() => onRestore?.(conversation)}
                  className="mt-3 min-h-11 rounded-xl border border-slate-200 px-3 text-xs text-primary-700"
                >
                  بازگردانی گفتگو
                </button>
              </div>
            ))}
          </>
        ) : (
          <>
            {unanswered.length > 0 && (
              <>
                <div className="bg-accent-50 px-3 py-1.5 text-xs font-bold text-accent-700">
                  بدون پاسخ ({unanswered.length})
                </div>
                {unanswered.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    selected={selectedId === conversation.id}
                    onSelect={onSelect}
                  />
                ))}
              </>
            )}

            {answered.length > 0 && (
              <>
                <div className="bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-500">
                  پاسخ داده‌شده ({answered.length})
                </div>
                {answered.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    selected={selectedId === conversation.id}
                    onSelect={onSelect}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
