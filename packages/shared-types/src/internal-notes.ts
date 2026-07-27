// یادداشت داخلی خصوصی روی مکالمه (فاز ۶) — فقط اپراتورها می‌بینن، هیچ‌وقت از کانال
// بازدیدکننده (ویجت) قابل‌دسترسی نیست؛ حتی به‌عنوان senderType جدید در جدول messages هم ذخیره نمی‌شه
// تا هیچ مسیر کدی به‌اشتباه نتونه محتواش رو برای بازدیدکننده پخش کنه (جدول جدا = ایزوله‌ی تضمینی).
export interface InternalNoteDto {
  id: string;
  conversationId: string;
  agentId: string;
  agentName: string;
  content: string;
  createdAt: string;
}

export interface CreateInternalNoteDto {
  content: string;
}
