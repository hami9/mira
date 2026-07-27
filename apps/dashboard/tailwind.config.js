/** @type {import('tailwindcss').Config} */
// پالت برند میرا — استخراج‌شده از لوگو (راهنمای کامل: docs/brand/README.md)
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // آبی برند (حباب اول لوگو) — سایه‌ی اصلی: 600
        primary: {
          50: '#F0F6FE',
          100: '#DEEAFC',
          200: '#C3D9FA',
          300: '#9ABFF5',
          400: '#6A9CEF',
          500: '#447EE9',
          600: '#2E6BE6',
          700: '#2455C4',
          800: '#23479C',
          900: '#223E7C',
          950: '#18294F',
        },
        // فیروزه‌ای برند (حباب دوم لوگو) — نقش: هوش مصنوعی/ربات — سایه‌ی اصلی: 500
        teal: {
          50: '#EFFCF9',
          100: '#D7F5EF',
          200: '#B2EAE0',
          300: '#7FD9CC',
          400: '#3ECDBB',
          500: '#17B8A6',
          600: '#0F9887',
          700: '#0F7A6E',
          800: '#11615A',
          900: '#12504A',
          950: '#042F2C',
        },
        // نارنجی قلب لوگو — نقش: نشان نخوانده/تأکید — سایه‌ی اصلی: 500
        accent: {
          50: '#FEF9EC',
          100: '#FCEFCA',
          200: '#F9DE90',
          300: '#F7C956',
          400: '#F6BB3F',
          500: '#F5A623',
          600: '#DF8A10',
          700: '#B9690F',
          800: '#965114',
          900: '#7B4314',
          950: '#472306',
        },
      },
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'Arial', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #2E6BE6 0%, #17B8A6 100%)',
      },
      boxShadow: {
        brand: '0 4px 14px rgba(46, 107, 230, 0.35)',
        'brand-lg': '0 18px 45px rgba(15, 40, 90, 0.35)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
