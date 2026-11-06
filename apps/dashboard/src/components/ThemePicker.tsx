import { useSyncExternalStore } from 'react';
import { getThemeMode, setThemeMode, subscribeTheme, type ThemeMode } from '../theme';

export function ThemePicker() {
  const mode = useSyncExternalStore(subscribeTheme, getThemeMode);
  return (
    <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700">
      <span aria-hidden="true">◐</span>
      <select
        aria-label="رنگ‌بندی داشبورد"
        value={mode}
        onChange={(event) => setThemeMode(event.target.value as ThemeMode)}
        className="min-h-11 min-w-0 bg-transparent text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
      >
        <option value="light">روشن</option>
        <option value="dark">تیره</option>
        <option value="system">هماهنگ با سیستم</option>
      </select>
    </label>
  );
}
