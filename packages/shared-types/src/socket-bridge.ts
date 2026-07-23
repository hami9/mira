// کانال Redis pub/sub که worker با آن نتیجه‌ی AI (پاسخ ربات، پیشنهاد Copilot) را به فرآیند api
// می‌رساند تا از طریق Socket.io (که فقط در api زنده است) به کلاینت‌ها پخش شود.
export const SOCKET_BRIDGE_CHANNEL = 'mira:socket-events';

export interface SocketBridgeMessage {
  room: string;
  event: string;
  data: unknown;
}
