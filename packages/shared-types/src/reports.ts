export interface DailyCountDto {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface CsatSummaryDto {
  average: number | null; // ۱ تا ۵
  totalRatings: number;
  positivePercent: number | null; // درصد امتیازهای ۴ و ۵
}

export interface ReportsOverviewDto {
  totalConversations: number;
  dailyCounts: DailyCountDto[];
  // میانگین فاصله‌ی زمانی بین اولین پیام بازدیدکننده تا اولین پاسخ اپراتور انسانی (نه ربات)
  avgFirstResponseMinutes: number | null;
  csat: CsatSummaryDto;
}

export interface AgentPerformanceDto {
  agentId: string;
  agentName: string;
  conversationsHandled: number;
  avgFirstResponseMinutes: number | null;
  avgCsatScore: number | null;
}
