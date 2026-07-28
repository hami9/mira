import { describe, it, expect } from 'vitest';
import { parseModelOutput } from '../../apps/worker/src/ai/parse-model-output';

// قرارداد: مدل با «CONFIDENCE: <عدد>\nANSWER: <متن>» جواب می‌دهد و در یک فراخوانی پارس می‌شود.
// مهم‌ترین رفتار اینجا **fail-safe** است: هر خروجی‌ای که پارس نشود باید `confidence: null`
// بدهد تا صداکننده مکالمه را به انسان بسپارد. اگر این بشکند، پاسخ بی‌اعتبار مدل مستقیم
// به مشتری می‌رسد.
describe('parseModelOutput', () => {
  it('خروجی درست را پارس می‌کند', () => {
    const { confidence, answer } = parseModelOutput(
      'CONFIDENCE: 0.92\nANSWER: سفارش شما فردا ارسال می‌شود.',
    );
    expect(confidence).toBe(0.92);
    expect(answer).toBe('سفارش شما فردا ارسال می‌شود.');
  });

  it('پاسخ چندخطی کامل برداشته می‌شود', () => {
    const { answer } = parseModelOutput('CONFIDENCE: 0.8\nANSWER: خط اول\nخط دوم\nخط سوم');
    expect(answer).toBe('خط اول\nخط دوم\nخط سوم');
  });

  it('به بزرگی و کوچکی حروف برچسب‌ها حساس نیست', () => {
    const { confidence, answer } = parseModelOutput('confidence: 0.5\nanswer: باشه');
    expect(confidence).toBe(0.5);
    expect(answer).toBe('باشه');
  });

  it('اطمینان صحیح (بدون اعشار)', () => {
    expect(parseModelOutput('CONFIDENCE: 1\nANSWER: بله').confidence).toBe(1);
    expect(parseModelOutput('CONFIDENCE: 0\nANSWER: نه').confidence).toBe(0);
  });

  // ↓ رفتار fail-safe — هر کدام از این‌ها باید به انسان واگذار شود
  it('نبودِ CONFIDENCE یعنی null (واگذاری به انسان)', () => {
    expect(parseModelOutput('ANSWER: یک جواب بدون اطمینان').confidence).toBeNull();
  });

  it('خروجی کاملاً بدفرمت یعنی null و پاسخ خالی', () => {
    const { confidence, answer } = parseModelOutput('یک متن آزاد بدون هیچ برچسبی');
    expect(confidence).toBeNull();
    expect(answer).toBe('');
  });

  it('عدد نامعتبر در CONFIDENCE یعنی null، نه NaN', () => {
    const { confidence } = parseModelOutput('CONFIDENCE: ...\nANSWER: چیزی');
    expect(confidence).toBeNull();
    expect(Number.isNaN(confidence as unknown as number)).toBe(false);
  });

  it('رشته‌ی خالی امن است', () => {
    expect(parseModelOutput('')).toEqual({ confidence: null, answer: '' });
  });

  it('CONFIDENCE بدون ANSWER پاسخ خالی می‌دهد', () => {
    const { confidence, answer } = parseModelOutput('CONFIDENCE: 0.9');
    expect(confidence).toBe(0.9);
    expect(answer).toBe('');
  });
});
