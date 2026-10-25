import { useRef, useState } from 'react';
import { useApiClient } from '../api-context';

interface Props {
  value: string;
  target: 'assistant' | 'me';
  label: string;
  onChange: (url: string) => void;
}

export function AvatarUpload({ value, target, label, onChange }: Props) {
  const api = useApiClient();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selection = useRef(0);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const scale = image ? Math.max(256 / image.naturalWidth, 256 / image.naturalHeight) * zoom : 1;
  const width = (image?.naturalWidth || 256) * scale;
  const height = (image?.naturalHeight || 256) * scale;
  const left = ((256 - width) * position.x) / 100;
  const top = ((256 - height) * position.y) / 100;
  const clamp = (n: number) => Math.min(100, Math.max(0, n));

  async function choose(file?: File) {
    const id = ++selection.current;
    setError('');
    setImage(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('حداکثر حجم عکس ۱۰ مگابایت است.');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('فقط عکس PNG، JPEG یا WebP انتخاب کنید.');
      return;
    }
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const next = new Image();
      next.src = url;
      await next.decode();
      if (next.naturalWidth * next.naturalHeight > 40_000_000) throw new Error('dimensions');
      if (id !== selection.current) return;
      setImage(next);
      setZoom(1);
      setPosition({ x: 50, y: 50 });
    } catch {
      if (id === selection.current) setError('این عکس قابل خواندن نیست؛ عکس کوچک‌تری انتخاب کنید.');
    }
  }

  async function save() {
    if (!image || busy) return;
    setBusy(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.beginPath();
      ctx.arc(128, 128, 128, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(image, left, top, width, height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('image'))),
          'image/png',
        ),
      );
      const result = await api.uploadAvatar(target, blob);
      onChange(result.url);
      setImage(null);
    } catch {
      setError('ذخیره تصویر انجام نشد؛ دوباره تلاش کنید.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4" disabled={busy}>
      <legend className="px-1 text-xs font-bold text-slate-700">{label}</legend>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <img
            src={value}
            alt={label}
            className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-sm"
          />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-full bg-teal-100 text-xl text-teal-700">
            ✦
          </span>
        )}
        <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus-within:ring-2 focus-within:ring-primary-300">
          انتخاب عکس
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={label}
            className="sr-only"
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <p className="text-[11px] leading-6 text-slate-500">
          PNG، JPEG یا WebP · حداکثر ۱۰ مگابایت
          <br />
          پس از تأیید برش، تصویر ذخیره می‌شود.
        </p>
      </div>
      {image && (
        <div className="mt-4 space-y-3" role="group" aria-label="برش دایره‌ای تصویر">
          <div
            className="mx-auto aspect-square w-64 touch-none overflow-hidden rounded-full bg-slate-200 ring-4 ring-white shadow-sm cursor-move"
            style={{ position: 'relative', maxWidth: '100%' }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, left, top };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const ratio = 256 / e.currentTarget.clientWidth;
              setPosition({
                x:
                  width > 256
                    ? clamp(
                        ((drag.current.left + (e.clientX - drag.current.x) * ratio) /
                          (256 - width)) *
                          100,
                      )
                    : 50,
                y:
                  height > 256
                    ? clamp(
                        ((drag.current.top + (e.clientY - drag.current.y) * ratio) /
                          (256 - height)) *
                          100,
                      )
                    : 50,
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <img
              src={image.src}
              alt="پیش‌نمایش برش"
              draggable={false}
              style={{
                position: 'absolute',
                width: `${(width / 256) * 100}%`,
                height: `${(height / 256) * 100}%`,
                maxWidth: 'none',
                left: `${(left / 256) * 100}%`,
                top: `${(top / 256) * 100}%`,
                pointerEvents: 'none',
              }}
            />
          </div>
          <p className="text-center text-[11px] text-slate-500">
            عکس را بکشید یا از کنترل‌های زیر استفاده کنید.
          </p>
          <label className="flex items-center gap-3 text-xs text-slate-600">
            بزرگ‌نمایی
            <input
              aria-label="بزرگ‌نمایی عکس"
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="min-w-0 flex-1 accent-teal-600"
            />
          </label>
          <label className="flex items-center gap-3 text-xs text-slate-600">
            افقی
            <input
              aria-label="جابه‌جایی افقی عکس"
              type="range"
              min="0"
              max="100"
              value={position.x}
              onChange={(e) => setPosition((p) => ({ ...p, x: Number(e.target.value) }))}
              className="min-w-0 flex-1 accent-teal-600"
            />
          </label>
          <label className="flex items-center gap-3 text-xs text-slate-600">
            عمودی
            <input
              aria-label="جابه‌جایی عمودی عکس"
              type="range"
              min="0"
              max="100"
              value={position.y}
              onChange={(e) => setPosition((p) => ({ ...p, y: Number(e.target.value) }))}
              className="min-w-0 flex-1 accent-teal-600"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy ? 'در حال ذخیره…' : 'تأیید برش و ذخیره عکس'}
            </button>
            <button
              type="button"
              onClick={() => {
                selection.current++;
                setImage(null);
              }}
              className="rounded-xl px-3 py-2 text-xs text-slate-600"
            >
              انصراف
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}
