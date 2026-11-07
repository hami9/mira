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
      type="button"
      data-conversation-id={conversation.id}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(conversation)}
      className={`flex min-h-16 w-full items-start justify-between gap-2 rounded-xl border border-transparent px-3 py-2.5 text-start text-sm transition-colors ${
        selected ? 'border-primary-200 bg-primary-50' : 'hover:bg-gray-50'
      } ${isUrgent ? 'border-s-4 border-s-red-500' : ''}`}
    >
      <div className="min-w-0">
        <div
          className={`flex min-w-0 items-center gap-1.5 ${hasUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}
        >
          {isUrgent && (
            <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-800">
              فوری
            </span>
          )}
          <span className="truncate" title={conversationName(conversation)}>
            {conversationName(conversation)}
          </span>
        </div>
        <div className="mt-2 space-y-1">
          <VisitorFlags flags={conversation.visitorFlags} />
          <ModerationBadges moderation={conversation.visitorModeration} />
          <TagChips tags={conversation.tags} />
        </div>
        <div className="truncate text-xs text-gray-500">
          وضعیت: {STATUS_LABELS[conversation.status] ?? conversation.status}
          {conversation.department ? ` · ${conversation.department}` : ''}
        </div>
      </div>
      {hasUnread && (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent-100 px-1.5 text-[11px] font-bold text-accent-800">
          {conversation.unreadCount > 99 ? '۹۹+' : conversation.unreadCount.toLocaleString('fa-IR')}
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
    <div className="flex w-full min-w-0 flex-col overflow-hidden border-e border-gray-200 bg-white sm:w-72">
      <div className="border-b border-gray-100 px-4 py-4 text-base font-bold text-gray-800">
        مکالمات ({conversations.length.toLocaleString('fa-IR')})
        <div className="mt-1 truncate text-xs font-normal text-primary-600">{siteName}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-b border-gray-200 p-3">
        <input
          type="search"
          value={filters.search ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
          placeholder="جست‌وجوی نام، ایمیل یا دپارتمان…"
          aria-label="جست‌وجوی گفتگوها"
          className="input-base col-span-2 min-h-11 w-full rounded-xl bg-gray-50 px-3 text-xs"
        />
        {canDelete && (
          <label className="block min-w-0 text-[11px] font-medium text-slate-600">
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
        <label
          className={`block min-w-0 text-[11px] font-medium text-slate-600 ${canDelete ? '' : 'col-span-2'}`}
        >
          وضعیت گفتگو
          <select
            aria-label="وضعیت گفتگو"
            value={filters.status ?? ''}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value || undefined })}
            className="mt-1 w-full text-xs"
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="open">باز</option>
            <option value="pending">در انتظار</option>
            <option value="resolved">حل‌شده</option>
          </select>
        </label>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2" aria-busy={loading}>
        {loading && (
          <p role="status" className="p-3 text-xs text-slate-500">
            در حال دریافت گفتگوها…
          </p>
        )}
        {error && (
          <div role="alert" className="p-3 text-xs text-red-700">
            {error}
            <button type="button" onClick={onRetry} className="control-button mt-2">
              تلاش دوباره
            </button>
          </div>
        )}
        {!loading && !error && conversations.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600">
            {filters.search || filters.status
              ? 'گفتگویی با این فیلترها پیدا نشد.'
              : filters.deleted
                ? 'زباله‌دان خالی است.'
                : 'هنوز گفتگویی در این پوشه نیست.'}
            {(filters.search || filters.status) && (
              <button
                type="button"
                className="control-button mt-2 w-full"
                onClick={() => onFiltersChange({ deleted: filters.deleted })}
              >
                پاک کردن فیلترها
              </button>
            )}
          </div>
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
                  className="control-button mt-3"
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
                <div className="rounded-lg bg-accent-50 px-3 py-1.5 text-xs font-bold text-accent-800">
                  خوانده‌نشده ({unanswered.length.toLocaleString('fa-IR')})
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
                <div className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-600">
                  خوانده‌شده ({answered.length.toLocaleString('fa-IR')})
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
