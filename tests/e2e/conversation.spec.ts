import { test, expect, Browser, Page } from '@playwright/test';

// معیار پذیرش بند ۴ فاز ۰ نقشه‌راه:
//   «بازدیدکننده ویجت را باز می‌کند ← پیام می‌فرستد ← اپراتور پاسخ می‌دهد ← بازدیدکننده دریافت می‌کند»
//
// این تنها تستی است که **کل مسیر زنده** را می‌آزماید: ویجت → Socket.io → API → Postgres →
// داشبورد و برعکس. بقیه‌ی تست‌ها یا منطق خالص‌اند یا مستقیم با دیتابیس حرف می‌زنند.
//
// دو نکته‌ی طراحی که با اجرای واقعی به‌دست آمد (نه با حدس):
//  ۱. اپراتور **پیش از** ارسال پیام وارد می‌شود. هم واقعی‌تر است (اپراتور پشت داشبورد
//     نشسته) و هم race را حذف می‌کند: اگر بعد از ارسال وارد شویم و لیست دقیقاً همان لحظه
//     رفرش نشود، مکالمه‌ی تازه هیچ‌وقت بالای لیست دیده نمی‌شود.
//  ۲. هیچ‌جا `page.reload()` نمی‌زنیم: توکن‌های داشبورد در حافظه‌اند، پس رفرش = خروج از حساب.
//
// هر تست `browser.newContext()` جدا می‌سازد (نه تب جدید) تا بازدیدکننده و اپراتور
// حافظه/کوکی کاملاً مستقل داشته باشند، وگرنه تست چیزی را اثبات نمی‌کند.

const DASHBOARD_URL = process.env.E2E_DASHBOARD_URL || 'http://localhost:5173';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@kgkala.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!';

/** اپراتور وارد داشبورد می‌شود و منتظر مکالمه می‌ماند. */
async function loginOperator(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(DASHBOARD_URL);

  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);

  // ورود روی `10 درخواست در دقیقه` محدود شده است (@Throttle در auth.controller).
  // اگر کسی این تست را پشت‌سرهم اجرا کند به سقف می‌خورد و بدون این بررسی، خطا به‌شکل
  // گیج‌کننده‌ی «سایدبار دیده نشد» ظاهر می‌شود. پس صریح گزارشش می‌کنیم.
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/v1/auth/login'), { timeout: 30_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  if (response.status() === 429) {
    throw new Error(
      'login was rate limited (HTTP 429). The auth endpoint allows 10 requests/minute — ' +
        'wait a minute before re-running the suite back to back.',
    );
  }
  expect(response.ok(), `operator login should succeed (got ${response.status()})`).toBe(true);

  // بعد از ورود، پوسته‌ی سایدبار بالا می‌آید
  await expect(page.locator('aside, nav').first()).toBeVisible({ timeout: 30_000 });
  return page;
}

/** بازدیدکننده صفحه‌ی دمو را باز می‌کند و حباب ویجت را باز می‌کند. */
async function openWidget(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/demo.html');

  const bubble = page.locator('.mira-bubble');
  await expect(bubble).toBeVisible();
  await bubble.click();
  await expect(page.locator('.mira-panel.mira-open')).toBeVisible();
  return page;
}

async function sendFromWidget(page: Page, text: string): Promise<void> {
  await page.locator('.mira-input').fill(text);
  await page.locator('.mira-send').click();
}

/**
 * منتظر می‌ماند تا مکالمه‌ی تازه در لیست اپراتور ظاهر شود، بازش می‌کند و پیام را تأیید می‌کند.
 *
 * آیتم‌های لیست **متن پیام را نشان نمی‌دهند** — فقط `بازدیدکننده #<۸ رقم اول visitorId>` و
 * وضعیت. لیست با `createdAt DESC` مرتب است (conversations.service.ts)، و چون این تست
 * بازدیدکننده‌ی کاملاً تازه‌ای ساخته، مکالمه‌اش بالای لیست می‌نشیند.
 */
async function openNewestConversationWith(page: Page, text: string): Promise<void> {
  const items = page.locator('button', { hasText: 'بازدیدکننده #' });
  await expect(items.first()).toBeVisible({ timeout: 30_000 });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await items.first().click();
    const found = await page
      .getByText(text, { exact: false })
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (found) return;
    await page.waitForTimeout(1_000);
  }
  throw new Error(`the newest conversation never showed the message: ${text}`);
}

test.describe('live conversation, end to end', () => {
  test('visitor sends a message, operator replies, visitor receives it in realtime', async ({
    browser,
  }) => {
    // متن یکتا تا با داده‌ی باقی‌مانده از اجراهای قبلی قاطی نشود
    const visitorText = `سلام، سفارش من کی می‌رسد؟ (${Date.now()})`;
    const operatorText = `پاسخ اپراتور: تا ۴۸ ساعت آینده (${Date.now()})`;

    // اپراتور اول پشت داشبورد می‌نشیند
    const operator = await loginOperator(browser);

    // بعد بازدیدکننده پیام می‌فرستد
    const visitor = await openWidget(browser);
    await sendFromWidget(visitor, visitorText);
    await expect(visitor.locator('.mira-msg-visitor', { hasText: visitorText })).toBeVisible();

    // مکالمه‌ی تازه باید به لیست اپراتور برسد
    await openNewestConversationWith(operator, visitorText);

    await operator.locator('[placeholder="پاسخ خود را بنویسید..."]').fill(operatorText);
    await operator.locator('button', { hasText: 'ارسال' }).first().click();

    // ← قلب تست: پاسخ باید **بدون رفرش** به بازدیدکننده برسد (مسیر Socket.io)
    await expect(visitor.locator('.mira-msg-agent', { hasText: operatorText })).toBeVisible({
      timeout: 30_000,
    });

    await visitor.context().close();
    await operator.context().close();
  });

  test('malicious HTML in a visitor message is sanitised before the operator sees it', async ({
    browser,
  }) => {
    // قاعده‌ی ۵: هر ورودی از `sanitizeMessageContent` می‌گذرد. اگر این بشکند، XSS ذخیره‌شده
    // مستقیم در داشبورد اپراتور اجرا می‌شود. سناریوی دستی README، این‌بار خودکار.
    const marker = `xss-${Date.now()}`;
    const malicious = `<script>window.__pwned=1</script><img src=x onerror="window.__pwned=1">${marker}`;

    const operator = await loginOperator(browser);

    const visitor = await openWidget(browser);
    await sendFromWidget(visitor, malicious);

    await openNewestConversationWith(operator, marker);

    // نه اسکریپت اجرا شده باشد، نه تگی در DOM مانده باشد
    expect(
      await operator.evaluate(() => (window as never as { __pwned?: number }).__pwned),
    ).toBeUndefined();
    expect(await operator.content()).not.toContain('window.__pwned');
    expect(await operator.locator('img[src="x"]').count()).toBe(0);

    await visitor.context().close();
    await operator.context().close();
  });
});
