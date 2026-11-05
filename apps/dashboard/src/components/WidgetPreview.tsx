import { useEffect, useRef, useState } from 'react';
import { MessageSenderType, type WidgetAppearance, type WidgetAssistant } from '@mira/shared-types';
import { WidgetUi } from '../../../widget/src/ui';
import { API_URL } from '../config';

interface Props {
  appearance: WidgetAppearance;
  assistant?: WidgetAssistant;
  viewport: 'mobile' | 'desktop';
}
export function WidgetPreview({ appearance, assistant, viewport }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const widget = useRef<WidgetUi | null>(null);
  const [width, setWidth] = useState(400);
  const [frameReady, setFrameReady] = useState(false);
  const [restart, setRestart] = useState(0);
  const [notice, setNotice] = useState(
    'پیش‌نمایش محلی است؛ پیامی برای مشتری یا پشتیبان ارسال نمی‌شود.',
  );
  const latest = useRef({ appearance, assistant });
  latest.current = { appearance, assistant };
  const sample = (content = 'برای انتخاب محصول راهنمایی می‌خواهم.') => {
    const ui = widget.current;
    if (!ui) return;
    ui.appendMessage(content, MessageSenderType.VISITOR);
    ui.appendMessage(
      'این پاسخ نمونه است. متن و محصولات واقعی از منابع همان فروشگاه نمایش داده می‌شوند.',
      MessageSenderType.BOT,
      {
        id: crypto.randomUUID(),
        conversationId: 'preview',
        senderType: MessageSenderType.BOT,
        senderId: null,
        content: '',
        createdAt: new Date().toISOString(),
        aiMetadata: {
          products: [
            {
              id: 'sample',
              name: 'محصول نمونه برای پیش‌نمایش',
              url: 'https://example.com/product',
              imageUrl: null,
              price: '1250000',
              currency: 'IRT',
              inStock: true,
            },
          ],
          sources: [{ id: 'sample', title: 'منبع نمونه فروشگاه' }],
        },
      },
    );
  };
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!frameReady) return;
    const doc = frame.current?.contentDocument;
    if (!doc?.body) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    doc.documentElement.lang = 'fa';
    doc.documentElement.dir = 'rtl';
    doc.body.style.margin = '0';
    doc.body.style.background = '#eff3f5';
    const meta = doc.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1';
    doc.head.appendChild(meta);
    const onLink = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.('a')) {
        event.preventDefault();
        setNotice('در پیش‌نمایش، لینک باز نمی‌شود؛ در سایت مشتری قابل استفاده است.');
      }
    };
    doc.addEventListener('click', onLink, true);
    const ui = new WidgetUi(
      { onSend: async (content) => sample(content), onTypingChange: () => {} },
      {
        appearance: latest.current.appearance,
        document: doc,
        fontUrl: new URL('/widget-dist/mira-font.woff2', API_URL || window.location.origin).href,
      },
    );
    widget.current = ui;
    ui.configureAssistant(latest.current.assistant);
    ui.setConnected(true);
    ui.openPanel();
    previousFocus?.focus({ preventScroll: true });
    return () => {
      doc.removeEventListener('click', onLink, true);
      ui.destroy();
      widget.current = null;
    };
  }, [frameReady, restart]);
  useEffect(() => {
    widget.current?.configureAppearance({ appearance });
    widget.current?.configureAssistant(assistant);
  }, [appearance, assistant]);
  const frameWidth = viewport === 'mobile' ? 375 : 1000;
  const frameHeight = viewport === 'mobile' ? 812 : 820;
  const scale = Math.min(1, width / frameWidth);
  return (
    <section
      aria-label="پیش‌نمایش واقعی ویجت"
      className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3"
    >
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => setRestart((value) => value + 1)}
          className="min-h-11 rounded-lg border bg-white px-3"
        >
          شروع دوباره پیش‌نمایش
        </button>
        <button
          type="button"
          onClick={() => widget.current?.openPanel()}
          className="min-h-11 rounded-lg border bg-white px-3"
        >
          نمایش پنجره
        </button>
        <button
          type="button"
          onClick={() => widget.current?.bubble.click()}
          className="min-h-11 rounded-lg border bg-white px-3"
        >
          دکمه شناور
        </button>
        <button
          type="button"
          onClick={() => widget.current?.replayAnimations()}
          className="min-h-11 rounded-lg border bg-white px-3"
        >
          اجرای دوباره انیمیشن
        </button>
        <button
          type="button"
          onClick={() => sample()}
          className="min-h-11 rounded-lg border bg-white px-3"
        >
          پاسخ نمونه
        </button>
      </div>
      <div
        ref={host}
        className="flex justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
        style={{ height: frameHeight * scale }}
      >
        <div
          style={{
            width: frameWidth,
            height: frameHeight,
            flexShrink: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
          }}
        >
          <iframe
            ref={frame}
            srcDoc="<!doctype html><html lang='fa' dir='rtl'><head></head><body></body></html>"
            onLoad={() => setFrameReady(true)}
            title="پیش‌نمایش ویجت"
            style={{ border: 0, width: frameWidth, height: frameHeight, display: 'block' }}
          />
        </div>
      </div>
      <p role="status" className="mt-3 text-xs leading-6 text-slate-500">
        {notice}
      </p>
    </section>
  );
}
