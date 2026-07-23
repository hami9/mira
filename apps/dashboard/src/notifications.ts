// اعلان صوتی با Web Audio API (بدون نیاز به فایل صوتی خارجی) + اعلان مرورگری برای پیام‌های تازه بازدیدکننده

let audioContext: AudioContext | null = null;

export function playNotificationSound(): void {
  try {
    audioContext ??= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.35);
  } catch {
    // پخش صدا در برخی مرورگرها بدون تعامل کاربر مسدود می‌شه؛ مهم نیست، فقط نادیده بگیر
  }
}

export function ensureNotificationPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => undefined);
  }
}

export function showBrowserNotification(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  new Notification(title, { body });
}
