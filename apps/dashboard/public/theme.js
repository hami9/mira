// پیش از بارگذاری رنگ‌ها، انتخاب قبلی اعمال می‌شود تا صفحه روشن چشمک نزند.
(function () {
  var mode = 'system';
  try {
    mode = window.localStorage.getItem('mira-dashboard-theme') || 'system';
  } catch {
    // اگر ذخیره مرورگر در دسترس نیست، حالت سیستم اعمال می‌شود.
  }
  var dark =
    mode === 'dark' ||
    (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
})();
