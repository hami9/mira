const MAX_CHUNK_CHARS = 800;

// chunking ساده و بدون همپوشانی: پاراگراف‌ها رو تا سقف MAX_CHUNK_CHARS به هم می‌چسبونه.
// برای اسناد کوتاه/متوسط (مقیاس یک فروشگاه) کافیه؛ نیازی به کتابخانه‌ی chunking جدا نیست.
export function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > MAX_CHUNK_CHARS && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) {
    chunks.push(current);
  }

  // اگه یک پاراگراف تنها از سقف بزرگ‌تر بود (بدون خط خالی داخلش)، با برش ساده تقسیمش کن
  return chunks.flatMap((chunk) => {
    if (chunk.length <= MAX_CHUNK_CHARS) return [chunk];
    const parts: string[] = [];
    for (let i = 0; i < chunk.length; i += MAX_CHUNK_CHARS) {
      parts.push(chunk.slice(i, i + MAX_CHUNK_CHARS));
    }
    return parts;
  });
}
