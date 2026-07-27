import { useId } from 'react';

interface MiraLogoProps {
  /** ارتفاع نشان به پیکسل */
  size?: number;
  /** انیمیشن ترسیم/تپش (فقط برای جاهای شاخص مثل ورود و سایدبار) */
  animated?: boolean;
  className?: string;
}

/**
 * نشان وکتوری میرا — همان هندسه‌ی docs/brand/mira-logo.svg
 * دو حباب گفتگو (آبی/فیروزه‌ای) که در میانه یک قلب می‌سازند.
 */
export function MiraLogo({ size = 40, animated = false, className }: MiraLogoProps) {
  // شناسه‌ی یکتا تا چند نمونه‌ی هم‌زمان لوگو، گرادیان‌های هم‌نام نسازند
  const uid = useId().replace(/:/g, '');
  const blueId = `miraBlue-${uid}`;
  const tealId = `miraTeal-${uid}`;
  const heartId = `miraHeart-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 200"
      height={size}
      className={className}
      role="img"
      aria-label="نشان میرا"
    >
      <defs>
        <linearGradient id={blueId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5F9DF3" />
          <stop offset="1" stopColor="#2455C4" />
        </linearGradient>
        <linearGradient id={tealId} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3ECDBB" />
          <stop offset="0.55" stopColor="#17B8A6" />
          <stop offset="1" stopColor="#2E6BE6" />
        </linearGradient>
        <linearGradient id={heartId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#2E6BE6" />
          <stop offset="0.55" stopColor="#17B8A6" />
          <stop offset="1" stopColor="#F5A623" />
        </linearGradient>
      </defs>
      {animated && (
        <style>{`
          .mira-ring-${uid} { stroke-dasharray: 352; stroke-dashoffset: 352; animation: miraDraw-${uid} 1.1s cubic-bezier(0.65,0,0.35,1) forwards; }
          .mira-ring2-${uid} { animation-delay: 0.15s; }
          .mira-tail-${uid} { opacity: 0; animation: miraFade-${uid} 0.5s ease-out 0.9s forwards; }
          .mira-heart-${uid} { transform-origin: 128px 100px; transform: scale(0); animation: miraPop-${uid} 0.55s cubic-bezier(0.34,1.56,0.64,1) 1s forwards, miraBeat-${uid} 2.6s ease-in-out 1.8s infinite; }
          @keyframes miraDraw-${uid} { to { stroke-dashoffset: 0; } }
          @keyframes miraFade-${uid} { to { opacity: 1; } }
          @keyframes miraPop-${uid} { to { transform: scale(1); } }
          @keyframes miraBeat-${uid} { 0%, 28%, 100% { transform: scale(1); } 8% { transform: scale(1.08); } 16% { transform: scale(0.98); } }
          @media (prefers-reduced-motion: reduce) {
            .mira-ring-${uid} { stroke-dashoffset: 0; animation: none; }
            .mira-tail-${uid} { opacity: 1; animation: none; }
            .mira-heart-${uid} { transform: scale(1); animation: none; }
          }
        `}</style>
      )}
      <g>
        <path
          className={animated ? `mira-tail-${uid}` : undefined}
          d="M200 141 C 208 156, 214 166, 224 175 C 206 173, 190 166, 178 155 Z"
          fill="#0F9887"
        />
        <circle
          className={animated ? `mira-ring-${uid} mira-ring2-${uid}` : undefined}
          cx="164"
          cy="94"
          r="56"
          fill="none"
          stroke={`url(#${tealId})`}
          strokeWidth="26"
        />
      </g>
      <g>
        <path
          className={animated ? `mira-tail-${uid}` : undefined}
          d="M56 141 C 48 156, 42 166, 32 175 C 50 173, 66 166, 78 155 Z"
          fill="#2455C4"
        />
        <circle
          className={animated ? `mira-ring-${uid}` : undefined}
          cx="92"
          cy="94"
          r="56"
          fill="none"
          stroke={`url(#${blueId})`}
          strokeWidth="26"
        />
      </g>
      <path
        className={animated ? `mira-heart-${uid}` : undefined}
        d="M128 142 C 105 124, 91 108, 91 89 C 91 74, 103 65, 115 67 C 121 68, 126 72, 128 78 C 130 72, 135 68, 141 67 C 153 65, 165 74, 165 89 C 165 108, 151 124, 128 142 Z"
        fill="#FFFFFF"
        stroke={`url(#${heartId})`}
        strokeWidth="11"
        strokeLinejoin="round"
      />
    </svg>
  );
}
