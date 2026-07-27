import { useEffect, useState } from 'react';
import type { InternalNoteDto } from '@mira/shared-types';
import { apiClient } from '../api';

interface InternalNotesPanelProps {
  conversationId: string;
}

// یادداشت داخلی فقط بین اپراتورهاست — بازدیدکننده هیچ‌وقت این‌ها را نمی‌بیند
export function InternalNotesPanel({ conversationId }: InternalNotesPanelProps) {
  const [notes, setNotes] = useState<InternalNoteDto[]>([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setNotes([]);
    apiClient.listInternalNotes(conversationId).then((data) => {
      if (!cancelled) setNotes(data);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  async function handleAdd(): Promise<void> {
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    try {
      const created = await apiClient.createInternalNote(conversationId, content);
      setNotes((prev) => [...prev, created]);
      setDraft('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between font-bold text-amber-900"
      >
        <span>🔒 یادداشت داخلی ({notes.length})</span>
        <span className="text-[10px] font-normal text-amber-700">
          {expanded ? 'بستن' : 'باز کردن'}
        </span>
      </button>

      {expanded && (
        <div className="mt-2">
          <p className="mb-2 text-[10px] text-amber-700">
            این یادداشت‌ها فقط برای اپراتورها قابل مشاهده است و برای بازدیدکننده ارسال نمی‌شود.
          </p>
          {notes.length === 0 && <p className="mb-2 text-amber-600">یادداشتی ثبت نشده است.</p>}
          {notes.map((note) => (
            <div key={note.id} className="mb-2 rounded bg-white/70 p-2">
              <div className="mb-0.5 text-[10px] text-amber-700">
                {note.agentName} · {new Date(note.createdAt).toLocaleString('fa-IR')}
              </div>
              <div className="whitespace-pre-wrap break-words text-gray-800">{note.content}</div>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="یادداشت داخلی برای همکاران..."
              className="flex-1 rounded border border-amber-300 p-1.5"
            />
            <button
              onClick={handleAdd}
              disabled={saving || !draft.trim()}
              className="rounded bg-amber-600 px-3 text-white disabled:opacity-60"
            >
              {saving ? '...' : 'افزودن'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
