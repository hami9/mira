import { io, Socket } from 'socket.io-client';
import {
  SocketEvent,
  MessagePayload,
  TypingPayload,
  ConversationUpdatedPayload,
  AiStatusPayload,
} from '@mira/shared-types';

export interface WidgetSocketHandlers {
  onConversationStarted: (conversationId: string) => void;
  onAiStatus: (payload: AiStatusPayload) => void;
  onMessage: (message: MessagePayload) => void;
  onTyping: (payload: TypingPayload) => void;
  onConversationUpdated: (payload: ConversationUpdatedPayload) => void;
  onError: (message: string) => void;
}

export function connectWidgetSocket(
  baseUrl: string,
  visitorToken: string,
  handlers: WidgetSocketHandlers,
): Socket {
  const socket = io(baseUrl, {
    auth: { token: visitorToken },
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
  });

  socket.on(SocketEvent.MessageNew, handlers.onMessage);
  socket.on(SocketEvent.ConversationStarted, (payload: { conversationId: string }) =>
    handlers.onConversationStarted(payload.conversationId),
  );
  socket.on(SocketEvent.Typing, handlers.onTyping);
  socket.on(SocketEvent.AiStatus, handlers.onAiStatus);
  socket.on(SocketEvent.ConversationUpdated, handlers.onConversationUpdated);
  socket.on(SocketEvent.ConnectionError, (payload: { message: string }) => {
    handlers.onError(payload?.message ?? 'خطای ناشناخته در اتصال');
  });

  return socket;
}
