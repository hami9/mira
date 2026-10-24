// کلید ویجت عمومی است؛ احراز هویت و محدودیت دامنه همچنان در سرور بررسی می‌شود.
const chatKey = new window.URLSearchParams(window.location.search).get('key');
if (!chatKey || chatKey.length > 255) {
  document.getElementById('chat-notice').textContent =
    'لینک گفتگو معتبر نیست؛ لینک را از فروشگاه دریافت کنید.';
} else {
  const chatScript = document.createElement('script');
  chatScript.src = '/widget-dist/widget.js';
  chatScript.dataset.widgetKey = chatKey;
  chatScript.dataset.autoOpen = 'true';
  chatScript.onerror = () => {
    document.getElementById('chat-notice').textContent =
      'بارگذاری گفتگو ناموفق بود؛ دوباره تلاش کنید.';
  };
  document.body.appendChild(chatScript);
}
