// پارس خروجی ربات RAG. مدل باید در قالب «CONFIDENCE: <عدد>\nANSWER: <متن>» جواب بدهد
// و همه‌چیز در یک فراخوانی انجام شود (نه دو تا) — تصمیم معماری بخش ۵ AGENTS.
//
// نکته‌ی حیاتی: اگر پارس شکست بخورد، `confidence` برابر `null` برمی‌گردد و صداکننده
// این را «مطمئن نیستم» تفسیر می‌کند و مکالمه را به انسان می‌سپارد. این fail-safe عمدی است؛
// هیچ‌وقت مقدار پیش‌فرضِ «مطمئن» نگذار، وگرنه خروجی بدفرمت مدل به‌جای اپراتور به مشتری می‌رسد.
export interface ParsedModelOutput {
  confidence: number | null;
  answer: string;
}

export function parseModelOutput(raw: string): ParsedModelOutput {
  const confidenceMatch = raw.match(/CONFIDENCE:\s*([\d.]+)/i);
  const answerMatch = raw.match(/ANSWER:\s*([\s\S]+)/i);
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : null;
  const answer = answerMatch ? answerMatch[1].trim() : '';
  return { confidence: confidence !== null && !isNaN(confidence) ? confidence : null, answer };
}
