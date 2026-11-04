import { expect, test, type Page } from '@playwright/test';
import { Client } from 'pg';
import { DEFAULT_AI_POLICY } from '@mira/shared-types';
import { hash } from 'bcryptjs';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const origin = new URL(process.env.E2E_API_URL || 'http://localhost:3000').origin;

test.describe('guided widget', () => {
  test.skip(!databaseUrl, 'Requires disposable database fixtures');
  let db: Client;
  let siteId: string;
  let widgetKey: string;

  test.beforeAll(async () => {
    db = new Client({ connectionString: databaseUrl });
    await db.connect();
  });
  test.beforeEach(async () => {
    widgetKey = crypto.randomUUID();
    siteId = (
      await db.query(
        `INSERT INTO sites (name,"widgetKey","allowedDomains",appearance,"aiEnabled","aiBotName","aiPolicy")
         VALUES ($1,$2,$3,$4,true,$5,$6) RETURNING id`,
        [
          'فروشگاه تجربه میرا',
          widgetKey,
          [origin],
          { color: '#177b70', accentColor: '#a6513d', position: 'bottom-left' },
          'راهنمای خرید میرا',
          {
            ...DEFAULT_AI_POLICY,
            useKnowledgeBase: false,
            serverContext: 'ارسال دو روز کاری است.',
          },
        ],
      )
    ).rows[0].id;
  });
  test.afterEach(async ({ page }) => {
    await page.close();
    if (siteId) await db.query('DELETE FROM sites WHERE id=$1', [siteId]);
  });
  test.afterAll(async () => {
    await db?.end();
  });

  async function openEmbedded(page: Page): Promise<void> {
    // فقط کلید صفحه دمو عوض می‌شود؛ جلسه، تاریخچه و سوکت به سرویس واقعی وصل‌اند.
    await page.route('**/demo.html', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()).replace('kgkala-demo-key', widgetKey),
      });
    });
    await page.goto('/demo.html');
    await page.locator('.mira-bubble').click();
    await expect(page.locator('.mira-header-title')).toHaveText('راهنمای خرید میرا');
    await page.locator('.mira-input').fill('آزمایش');
    await expect(page.locator('.mira-send')).toBeEnabled();
    await page.locator('.mira-input').fill('');
    await expect(page.locator('.mira-send')).toBeDisabled();
  }

  for (const width of [375, 768, 1280]) {
    test(`keeps welcome, composer and draft usable at ${width}px`, async ({
      page,
      request,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await openEmbedded(page);
      const panel = page.locator('.mira-panel');
      await expect(page.locator('.mira-intent')).toHaveCount(3);
      await expect(panel).toHaveClass(/mira-pos-left/);
      await expect(panel).toHaveCSS('--mira-color', '#177b70');
      await expect(panel).toHaveCSS('--mira-accent', '#a6513d');
      await expect(page.locator('.mira-input')).toBeInViewport();
      const bounds = await panel.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() =>
          [...document.fonts].some(
            (font) => font.family === 'MiraVazirmatn' && font.status === 'loaded',
          ),
        ),
      ).toBe(true);
      const font = await request.get('/widget-dist/mira-font.woff2', {
        headers: { Origin: origin },
      });
      expect(font.ok()).toBe(true);
      expect(font.headers()['access-control-allow-origin']).toBe(origin);
      await info.attach(`welcome-${width}`, {
        body: await page.screenshot({
          path: `test-results/widget-welcome-${width}.png`,
          animations: 'disabled',
        }),
        contentType: 'image/png',
      });
      const draft = 'یک هدفون برای استفاده روزمره می‌خواهم';
      await page.locator('.mira-input').fill(draft);
      await page.locator('.mira-expand').click();
      await expect(panel).toHaveClass(/mira-fullscreen/);
      await expect(page.locator('.mira-input')).toHaveValue(draft);
      await expect(panel).toHaveAttribute('aria-modal', 'true');
      // حرکت صفحه‌کلید نباید از گفتگوی تمام‌صفحه خارج شود.
      await page.locator('.mira-expand').focus();
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        expect(await panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      }
      await page.keyboard.press('Escape');
      await expect(panel).not.toHaveClass(/mira-fullscreen/);
      await expect(page.locator('.mira-input')).toHaveValue(draft);
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(page.locator('.mira-bubble')).toBeFocused();
      await page.locator('.mira-bubble').click();
      await expect(page.locator('.mira-input')).toHaveValue(draft);
    });
  }

  test('saves both brand colors from settings and applies them to existing embeds', async ({
    page,
    browser,
  }, info) => {
    const email = `${crypto.randomUUID()}@theme.test`;
    const password = 'Theme-fixture-only-123!';
    await db.query(
      `INSERT INTO agents ("siteId",email,"passwordHash","fullName",role) VALUES ($1,$2,$3,$4,'admin')`,
      [siteId, email, await hash(password, 4), 'مدیر ظاهر'],
    );
    await page.goto(process.env.E2E_DASHBOARD_URL || 'http://localhost:5173');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'ورود به داشبورد', exact: true }).click();
    await page.getByRole('button', { name: 'تنظیمات', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'بخش‌های تنظیمات', exact: true })
      .getByRole('button', { name: 'نصب و اتصال', exact: true })
      .click();
    const settings = page.getByRole('region', { name: 'نصب و شخصی‌سازی', exact: true });
    await settings.getByLabel('رنگ ویجت', { exact: true }).fill('#264e73');
    await settings.getByLabel('رنگ مکمل', { exact: true }).fill('#168b6a');
    const saved = page.waitForResponse(
      (r) => r.url().endsWith('/v1/sites/me') && r.request().method() === 'PATCH',
    );
    await settings.getByRole('button', { name: 'ذخیره ظاهر و دامنه‌ها' }).click();
    expect((await saved).ok()).toBe(true);
    expect(
      (await db.query('SELECT appearance FROM sites WHERE id=$1', [siteId])).rows[0].appearance,
    ).toMatchObject({ color: '#264e73', accentColor: '#168b6a' });
    const embed = await settings.getByLabel('کد نصب سایت', { exact: true }).inputValue();
    expect(embed).not.toContain('data-color=');
    expect(embed).not.toContain('data-accent-color=');
    await info.attach('theme-settings', {
      body: await settings.screenshot({
        path: 'test-results/widget-theme-settings.png',
        animations: 'disabled',
      }),
      contentType: 'image/png',
    });
    const visitor = await browser.newPage();
    try {
      await openEmbedded(visitor);
      await expect(visitor.locator('.mira-panel')).toHaveCSS('--mira-color', '#264e73');
      await expect(visitor.locator('.mira-panel')).toHaveCSS('--mira-accent', '#168b6a');
      await db.query('UPDATE sites SET appearance=appearance || $2::jsonb WHERE id=$1', [
        siteId,
        JSON.stringify({ accentColor: '#9744a2' }),
      ]);
      await visitor.reload();
      await visitor.locator('.mira-bubble').click();
      await expect(visitor.locator('.mira-panel')).toHaveCSS('--mira-accent', '#9744a2');
      await db.query('UPDATE sites SET appearance=appearance || $2::jsonb WHERE id=$1', [
        siteId,
        JSON.stringify({ accentColor: 'red; background:url(https://invalid.test)' }),
      ]);
      const fallback = visitor.waitForResponse((r) => r.url().endsWith('/v1/widget/sessions'));
      await visitor.reload();
      expect((await (await fallback).json()).appearance.accentColor).toBe('#168B6A');
    } finally {
      await visitor.close();
    }
  });

  test('persists a welcome intent through the live socket and recovers it', async ({ page }) => {
    await openEmbedded(page);
    const started = page.waitForResponse(
      (r) => r.url().endsWith('/v1/widget/conversations') && r.request().method() === 'POST',
    );
    await page.locator('.mira-intent').first().click();
    const conversationId = (await (await started).json()).conversationId;
    await expect(page.locator('.mira-msg-visitor')).toHaveCount(1);
    const stored = await db.query(
      'SELECT content FROM messages WHERE "siteId"=$1 AND "conversationId"=$2 AND "senderType"=$3',
      [siteId, conversationId, 'visitor'],
    );
    expect(stored.rows).toHaveLength(1);
    await expect(page.locator('.mira-msg-visitor')).toContainText(stored.rows[0].content);
    await expect(page.locator('.mira-welcome')).toHaveCount(0);
    if (process.env.AI_E2E === '1') {
      await expect(page.locator('.mira-msg-bot')).toHaveCount(1);
      await expect(page.locator('.mira-msg-bot')).toContainText('دو روز کاری');
    }
    await page.reload();
    await page.locator('.mira-bubble').click();
    await expect(page.locator('.mira-msg-visitor')).toHaveCount(1);
    await expect(page.locator('.mira-msg-visitor')).toContainText(stored.rows[0].content);
    await page.context().setOffline(true);
    await page.locator('.mira-input').fill('این پیش‌نویس حفظ شود');
    await expect(page.locator('.mira-send')).toBeDisabled();
    await page.context().setOffline(false);
    await expect(page.locator('.mira-send')).toBeEnabled();
    await expect(page.locator('.mira-input')).toHaveValue('این پیش‌نویس حفظ شود');
  });

  test('browses persisted product suggestions safely on mobile and fullscreen', async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await db.query('UPDATE sites SET "aiEnabled"=false WHERE id=$1', [siteId]);
    await page.goto(`/chat.html?key=${widgetKey}`);
    await expect(page.locator('.mira-panel')).toHaveClass(/mira-fullscreen/);
    await page.locator('.mira-input').fill('چند پیشنهاد می‌خواهم');
    await expect(page.locator('.mira-send')).toBeEnabled();
    const started = page.waitForResponse(
      (r) => r.url().endsWith('/v1/widget/conversations') && r.request().method() === 'POST',
    );
    await page.locator('.mira-send').click();
    const conversationId = (await (await started).json()).conversationId;
    await expect(page.locator('.mira-msg-visitor')).toHaveCount(1);
    const products = [
      { id: 'p1', name: 'هدفون روزمره', price: '2300000', inStock: true },
      { id: 'p2', name: 'کابل شارژ', price: '350000', inStock: true },
      { id: 'p3', name: 'پاوربانک ' + 'X'.repeat(160), price: '1800000', inStock: false },
    ].map((product) => ({
      ...product,
      url: `https://shop.example.test/products/${product.id}`,
      imageUrl: null,
      currency: 'IRT',
    }));
    await db.query(
      `INSERT INTO messages ("siteId","conversationId","senderType",content,"aiMetadata") VALUES ($1,$2,'bot',$3,$4)`,
      [
        siteId,
        conversationId,
        'این پیشنهادها را بررسی کنید.',
        {
          products: [...products, { ...products[0], id: 'unsafe', url: 'javascript:alert(1)' }],
          sources: [
            { id: 's1', title: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' },
          ],
        },
      ],
    );
    await page.reload();
    await expect(page.locator('.mira-product')).toHaveCount(3);
    await expect(page.locator('.mira-product').first()).toHaveAttribute('href', products[0].url);
    await expect(page.locator('.mira-product').first()).toHaveAttribute('rel', /noopener/);
    await expect(page.locator('.mira-source')).toHaveText('↗ <img src=x onerror=alert(1)>');
    await expect(page.locator('.mira-source img')).toHaveCount(0);
    await expect(page.locator('.mira-product-sort')).toBeVisible();
    await page.locator('.mira-product-sort').selectOption('price-asc');
    await expect(page.locator('.mira-product').first()).toContainText('کابل شارژ');
    for (const name of await page.locator('.mira-product strong').all())
      expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.locator('.mira-stock-filter').check();
    await expect(page.locator('.mira-product')).toHaveCount(2);
    await expect(page.locator('.mira-product').last()).toContainText('هدفون روزمره');
    expect(
      await page.locator('.mira-messages').evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await info.attach('mobile-products', {
      body: await page.screenshot({
        path: 'test-results/widget-products-mobile.png',
        animations: 'disabled',
      }),
      contentType: 'image/png',
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await info.attach('fullscreen-products', {
      body: await page.screenshot({
        path: 'test-results/widget-products-fullscreen.png',
        animations: 'disabled',
      }),
      contentType: 'image/png',
    });
  });
});
