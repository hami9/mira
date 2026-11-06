import { useEffect, useState } from 'react';
import { visitorDisplayName, type VisitorFlag, type VisitorModeration } from '@mira/shared-types';
import type { ConversationDto } from '../api';

export const FLAG_COLORS: Record<VisitorFlag['color'], string> = {
  red: 'border-red-200 bg-red-50 text-red-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  blue: 'border-blue-200 bg-blue-50 text-blue-800',
  violet: 'border-violet-200 bg-violet-50 text-violet-800',
  slate: 'border-slate-200 bg-slate-100 text-slate-700',
};
export function useModerationExpiry(moderation?: VisitorModeration): VisitorModeration | undefined {
  const [tick, setTick] = useState(0);
  const now = Date.now();
  useEffect(() => {
    const until = [moderation?.blockedUntil, moderation?.mutedUntil]
      .filter((value): value is string => !!value)
      .map((value) => new Date(value).getTime())
      .filter((value) => value > Date.now());
    if (!until.length) return;
    const timer = setTimeout(
      () => setTick((value) => value + 1),
      Math.min(...until) - Date.now() + 50,
    );
    return () => clearTimeout(timer);
  }, [moderation?.blockedUntil, moderation?.mutedUntil, tick]);
  return moderation
    ? {
        ...moderation,
        blocked:
          moderation.blocked &&
          (!moderation.blockedUntil || new Date(moderation.blockedUntil).getTime() > now),
        mutedUntil:
          moderation.mutedUntil && new Date(moderation.mutedUntil).getTime() > now
            ? moderation.mutedUntil
            : null,
      }
    : undefined;
}
export function conversationName(conversation: ConversationDto): string {
  return visitorDisplayName({
    id: conversation.visitorId,
    name: conversation.visitorName,
    displayName: conversation.visitorDisplayName,
  });
}
export function VisitorFlags({ flags = [] }: { flags?: VisitorFlag[] }) {
  return (
    <div className="flex flex-wrap gap-1" aria-label="پرچم‌های بازدیدکننده">
      {flags.map((flag) => (
        <span
          key={flag.id}
          className={`rounded-full border px-2 py-0.5 text-[10px] ${FLAG_COLORS[flag.color] ?? FLAG_COLORS.slate}`}
        >
          {flag.label}
        </span>
      ))}
    </div>
  );
}
export function ModerationBadges({ moderation }: { moderation?: VisitorModeration }) {
  const current = useModerationExpiry(moderation);
  return (
    <div className="flex flex-wrap gap-1 text-[10px]">
      {current?.blocked && (
        <span className="rounded-full bg-red-50 px-2 py-1 text-red-800">
          مسدود
          {current.blockedUntil
            ? ` تا ${new Date(current.blockedUntil).toLocaleString('fa-IR')}`
            : ''}
        </span>
      )}
      {current?.mutedUntil && (
        <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">
          بی‌صدا تا {new Date(current.mutedUntil).toLocaleString('fa-IR')}
        </span>
      )}
    </div>
  );
}
export function TagChips({ tags }: { tags: string[] }) {
  const colors = Object.keys(FLAG_COLORS) as VisitorFlag['color'][];
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => {
        const hash = Array.from(tag).reduce((sum, char) => sum + char.charCodeAt(0), 0);
        return (
          <span
            key={tag}
            className={`rounded-full border px-2 py-1 text-[10px] ${FLAG_COLORS[colors[hash % colors.length]]}`}
          >
            {tag}
          </span>
        );
      })}
    </div>
  );
}
