import { io, Socket } from 'socket.io-client';
import { SocketEvent, MessagePayload, TypingPayload } from '@mira/shared-types';
import { API_URL } from './config';

export interface ConversationUpdatedPayload {
  conversationId: string;
  lastMessage: MessagePayload;
}

export interface DashboardSocketHandlers {
  // برای تازه‌سازی لیست مکالمات (نه رندر متن گفتگو — آن کار خودِ ChatWindow با MessageNew انجام می‌دهد)
  onConversationUpdated: (payload: ConversationUpdatedPayload) => void;
  onTyping: (payload: TypingPayload) => void;
  onError: (message: string) => void;
}

export function connectDashboardSocket(
  accessToken: string,
  handlers: DashboardSocketHandlers,
): Socket {
  const socket = io(API_URL, {
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
  });

  socket.on(SocketEvent.ConversationUpdated, handlers.onConversationUpdated);
  socket.on(SocketEvent.Typing, handlers.onTyping);
  socket.on(SocketEvent.ConnectionError, (payload: { message: string }) => {
    handlers.onError(payload?.message ?? 'خطای ناشناخته در اتصال');
  });

  return socket;
}
