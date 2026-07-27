// شکل داده‌ای که API عمومی (فاز ۶) برمی‌گردونه — عمداً ساده‌تر از ConversationDto داخلی داشبورد
// (بدون unreadCount که مفهومش وابسته به یک اپراتور خاصه و برای فراخوان بیرونی معنی نداره)
export interface PublicConversationDto {
  id: string;
  status: string;
  department: string | null;
  tags: string[];
  priority: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface PublicMessageDto {
  id: string;
  senderType: string;
  content: string;
  createdAt: string;
}
