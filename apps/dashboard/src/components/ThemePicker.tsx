import { useSyncExternalStore } from 'react';
import { getThemeMode, setThemeMode, subscribeTheme, type ThemeMode } from '../theme';

export function ThemePicker() {
  const mode = useSyncExternalStore(subscribeTheme, getThemeMode);
  return (
    <label className="inline-flex min-w-0 items-center gap-2 text-xs text-slate-700">
      <span aria-hidden="true" className="hidden sm:inline">
        ◐
      </span>
      <select
        aria-label="رنگ‌بندی داشبورد"
        value={mode}
        onChange={(event) => setThemeMode(event.target.value as ThemeMode)}
        className="min-w-0 text-xs"
      >
        <option value="light">روشن</option>
        <option value="dark">تیره</option>
        <option value="system">هماهنگ با سیستم</option>
      </select>
    </label>
  );
}
