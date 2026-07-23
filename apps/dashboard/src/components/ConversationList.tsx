import { ConversationDto, ListConversationsParams } from '../api';

interface ConversationListProps {
  conversations: ConversationDto[];
  selectedId: string | null;
  filters: ListConversationsParams;
  onFiltersChange: (filters: ListConversationsParams) => void;
  onSelect: (conversation: ConversationDto) => void;
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
      onClick={() => onSelect(conversation)}
      className={`flex w-full items-start justify-between border-b border-gray-100 p-3 text-right text-sm hover:bg-gray-50 ${
        selected ? 'bg-blue-50' : ''
      } ${isUrgent ? 'border-r-4 border-r-red-500' : ''}`}
    >
      <div>
        <div className={hasUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}>
          {isUrgent && <span title="فوری">🔴 </span>}
          بازدیدکننده #{conversation.visitorId.slice(0, 8)}
        </div>
        <div className="text-xs text-gray-500">
          وضعیت: {STATUS_LABELS[conversation.status] ?? conversation.status}
          {conversation.department ? ` · ${conversation.department}` : ''}
        </div>
      </div>
      {hasUnread && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-[11px] font-bold text-white">
          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
        </span>
      )}
    </button>
  );
}

export function ConversationList({
  conversations,
  selectedId,
  filters,
  onFiltersChange,
  onSelect,
}: ConversationListProps) {
  const byUrgencyThenOrder = (a: ConversationDto, b: ConversationDto) =>
    a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1;
  const unanswered = conversations.filter((c) => c.unreadCount > 0).sort(byUrgencyThenOrder);
  const answered = conversations.filter((c) => c.unreadCount === 0).sort(byUrgencyThenOrder);

  return (
    <div className="flex w-64 flex-col overflow-hidden border-l border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-3 text-sm font-bold text-gray-700">
        مکالمات ({conversations.length})
      </div>
      <div className="space-y-2 border-b border-gray-200 p-2">
        <input
          value={filters.search ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
          placeholder="جست‌وجوی نام، ایمیل یا دپارتمان..."
          className="w-full rounded border border-gray-300 p-1.5 text-xs"
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
        {conversations.length === 0 && (
          <p className="p-3 text-sm text-gray-400">مکالمه‌ای پیدا نشد</p>
        )}

        {unanswered.length > 0 && (
          <>
            <div className="bg-green-50 px-3 py-1.5 text-xs font-bold text-green-800">
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
      </div>
    </div>
  );
}
