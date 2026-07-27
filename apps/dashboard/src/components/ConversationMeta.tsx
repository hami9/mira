import { useState } from 'react';
import { ConversationStatus } from '@mira/shared-types';
import { apiClient, ConversationDto } from '../api';

interface ConversationMetaProps {
  conversation: ConversationDto;
  onUpdated: (conversation: ConversationDto) => void;
}

export function ConversationMeta({ conversation, onUpdated }: ConversationMetaProps) {
  const [department, setDepartment] = useState(conversation.department ?? '');
  const [tagsInput, setTagsInput] = useState(conversation.tags.join(', '));
  const [saving, setSaving] = useState(false);

  async function saveDetails(): Promise<void> {
    setSaving(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const updated = await apiClient.updateConversation(conversation.id, {
        department: department.trim() || null,
        tags,
      });
      onUpdated(updated);
    } finally {
      setSaving(false);
    }
  }

  async function resolve(): Promise<void> {
    const updated = await apiClient.resolveConversation(conversation.id);
    onUpdated(updated);
  }

  const isResolved = conversation.status === ConversationStatus.RESOLVED;

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 p-2 text-xs">
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          onBlur={saveDetails}
          placeholder="دپارتمان"
          className="w-28 rounded border border-gray-300 p-1"
        />
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          onBlur={saveDetails}
          placeholder="برچسب‌ها (با کاما جدا کنید)"
          className="w-40 rounded border border-gray-300 p-1"
        />
        {saving && <span className="text-gray-400">در حال ذخیره...</span>}
        <button
          onClick={resolve}
          disabled={isResolved}
          className="mr-auto rounded bg-green-600 px-3 py-1 text-white disabled:bg-gray-300"
        >
          {isResolved ? 'حل‌شده' : 'حل مکالمه'}
        </button>
      </div>
      {conversation.summary && (
        <div className="border-t border-gray-100 bg-teal-50 px-2 py-1 text-xs text-teal-800">
          ✨ خلاصه: {conversation.summary}
        </div>
      )}
    </div>
  );
}
