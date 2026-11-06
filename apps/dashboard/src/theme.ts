export type ThemeMode = 'light' | 'dark' | 'system';
const key = 'mira-dashboard-theme';
const listeners = new Set<() => void>();
const media = window.matchMedia('(prefers-color-scheme: dark)');
function valid(value: string | null): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system';
}
function saved(): ThemeMode {
  try {
    return valid(localStorage.getItem(key));
  } catch {
    return 'system';
  }
}
let mode = saved();
function apply(): void {
  const dark = mode === 'dark' || (mode === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  for (const listener of listeners) listener();
}
export function setThemeMode(value: ThemeMode): void {
  mode = valid(value);
  try {
    localStorage.setItem(key, mode);
  } catch {
    /* انتخاب در این نشست حفظ می‌شود. */
  }
  apply();
}
export const getThemeMode = (): ThemeMode => mode;
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function initializeTheme(): void {
  apply();
  media.addEventListener('change', apply);
  window.addEventListener('storage', (event) => {
    if (event.key === key || event.key === null) {
      mode = saved();
      apply();
    }
  });
}
