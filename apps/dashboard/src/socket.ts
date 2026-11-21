import { io, Socket } from 'socket.io-client';
import {
  SocketEvent,
  MessagePayload,
  TypingPayload,
  type VisitorUpdatedPayload,
} from '@mira/shared-types';
import { API_URL } from './config';

export interface ConversationUpdatedPayload {
  conversationId: string;
  lastMessage?: MessagePayload;
  deleted?: boolean;
  deletedAt?: string | null;
}

export interface DashboardSocketHandlers {
  // برای تازه‌سازی لیست مکالمات (نه رندر متن گفتگو — آن کار خودِ ChatWindow با MessageNew انجام می‌دهد)
  onConversationUpdated: (payload: ConversationUpdatedPayload) => void;
  onTyping: (payload: TypingPayload) => void;
  onError: (message: string) => void;
  onVisitorUpdated?: (visitor: VisitorUpdatedPayload) => void;
}

const SERVER_DISCONNECT_RETRY_MS = 5000;

export function connectDashboardSocket(
  accessToken: string | (() => string | null | Promise<string | null>),
  handlers: DashboardSocketHandlers,
): Socket {
  const readToken = async () => (typeof accessToken === 'function' ? accessToken() : accessToken);
  const socket = io(API_URL, {
    auth: (callback) => {
      void readToken()
        .catch(() => null)
        .then((token) => callback({ token }));
    },
    // هر حساب اتصال مستقل دارد؛ manager مشترک نباید هویت فروشگاه‌ها را مخلوط کند.
    forceNew: true,
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
  });

  // Socket.io بعد از قطع از سمت سرور خودکار وصل نمی‌شود؛ رد شدن توکن منقضی نباید اتصال را دائمی ببندد.
  let closed = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  const closeSocket = socket.disconnect.bind(socket);
  socket.disconnect = () => {
    closed = true;
    clearTimeout(retryTimer);
    return closeSocket();
  };
  socket.on('disconnect', (reason) => {
    if (closed || reason !== 'io server disconnect') return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      void readToken()
        .catch(() => null)
        .then((token) => {
          if (token && !closed && !socket.connected) socket.connect();
        });
    }, SERVER_DISCONNECT_RETRY_MS);
  });

  socket.on(SocketEvent.ConversationUpdated, handlers.onConversationUpdated);
  socket.on(SocketEvent.Typing, handlers.onTyping);
  if (handlers.onVisitorUpdated) socket.on(SocketEvent.VisitorUpdated, handlers.onVisitorUpdated);
  socket.on(SocketEvent.ConnectionError, (payload: { message: string }) => {
    handlers.onError(payload?.message ?? 'خطای ناشناخته در اتصال');
  });

  return socket;
}
