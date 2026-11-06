export interface VisitorFlag {
  id: string;
  label: string;
  color: 'red' | 'amber' | 'green' | 'blue' | 'violet' | 'slate';
}

export interface VisitorModeration {
  blocked: boolean;
  blockedUntil: string | null;
  mutedUntil: string | null;
}

export interface ModerationPolicy {
  spamEnabled: boolean;
  blockMinutes: number;
}

export const DEFAULT_MODERATION_POLICY: ModerationPolicy = { spamEnabled: true, blockMinutes: 10 };

export interface UpdateVisitorDetailsDto {
  displayName?: string | null;
  flags?: VisitorFlag[];
}

export interface ModerateVisitorDto {
  action: 'block' | 'unblock' | 'mute' | 'unmute';
  durationMinutes?: number;
  reason?: string;
}

export interface VisitorUpdatedPayload {
  visitorId: string;
  displayName: string | null;
  flags: VisitorFlag[];
  moderation: VisitorModeration;
}

export interface VisitorModerationPayload extends VisitorModeration {
  visitorId: string;
}

export type MessageSendErrorCode =
  'VISITOR_BLOCKED' | 'VISITOR_MUTED' | 'CONVERSATION_DELETED' | 'RATE_LIMITED' | 'SEND_FAILED';
export type MessageAck =
  { id: string } | { error: { code: MessageSendErrorCode; message: string; retryUntil?: string } };

export function visitorDisplayName(visitor: {
  displayName?: string | null;
  name?: string | null;
  externalId?: string | null;
  id?: string;
}): string {
  return visitor.displayName?.trim() || visitor.name?.trim() || visitor.id || 'بازدیدکننده';
}

export function visitorModerationState(
  visitor: {
    blockedAt?: Date | string | null;
    blockedUntil?: Date | string | null;
    mutedUntil?: Date | string | null;
  },
  now = Date.now(),
): VisitorModeration {
  const until = visitor.blockedUntil ? new Date(visitor.blockedUntil).toISOString() : null;
  return {
    blocked: !!visitor.blockedAt && (!until || new Date(until).getTime() > now),
    blockedUntil: until,
    mutedUntil:
      visitor.mutedUntil && new Date(visitor.mutedUntil).getTime() > now
        ? new Date(visitor.mutedUntil).toISOString()
        : null,
  };
}
