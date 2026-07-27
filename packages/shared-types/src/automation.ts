// قوانین اتوماسیون ساده (فاز ۶): فقط یک نوع trigger (کلیدواژه در پیام بازدیدکننده) —
// عمداً به همین یک نوع محدود شده تا با نمونه‌ی خود نقشه‌راه («مسیریابی خودکار بر اساس کلمه کلیدی»)
// منطبق بمونه، بدون ساختن یک rule-engine عمومی که در این مقیاس نیازی بهش نیست.
export type AutomationTriggerType = 'keyword_in_message';

export type AutomationActionType = 'set_department' | 'add_tag' | 'set_priority_high';

export interface AutomationRuleDto {
  id: string;
  name: string;
  triggerType: AutomationTriggerType;
  // کلیدواژه‌ها با کاما جدا می‌شن؛ اگر هرکدوم در پیام باشه قانون اجرا می‌شه
  triggerValue: string;
  actionType: AutomationActionType;
  // برای set_priority_high مقدار لازم نیست (null)
  actionValue: string | null;
  enabled: boolean;
  createdAt: string;
}

export interface CreateAutomationRuleDto {
  name: string;
  triggerValue: string;
  actionType: AutomationActionType;
  actionValue?: string | null;
}

export interface UpdateAutomationRuleDto {
  name?: string;
  triggerValue?: string;
  actionType?: AutomationActionType;
  actionValue?: string | null;
  enabled?: boolean;
}
