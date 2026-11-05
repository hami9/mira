import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { hash } from 'bcryptjs';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { normalizeWidgetAppearance, exportWidgetTemplate } from '@mira/shared-types';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const origin = new URL(process.env.E2E_API_URL || 'http://localhost:3000').origin;
const dashboard = process.env.E2E_DASHBOARD_URL || 'http://localhost:5173';
const password = 'Studio-fixture-only-123!';
test.describe('no-code widget studio', () => {
  test.skip(!databaseUrl, 'Requires disposable tenant fixtures');
  let db: Client;
  const sites: string[] = [];
  const keys = [crypto.randomUUID(), crypto.randomUUID()];
  const emails = [0, 1, 2].map(() => `${crypto.randomUUID()}@studio.test`);
  const tokens: string[] = [];
  test.beforeAll(async ({ request }) => {
    db = new Client({ connectionString: databaseUrl });
    await db.connect();
    for (let i = 0; i < 2; i++) {
      sites.push(
        (
          await db.query(
            `INSERT INTO sites (name,"widgetKey","allowedDomains") VALUES ($1,$2,$3) RETURNING id`,
            [`فروشگاه استودیو ${i}`, keys[i], [origin]],
          )
        ).rows[0].id,
      );
    }
    for (let i = 0; i < 3; i++) {
      await db.query(
        `INSERT INTO agents ("siteId",email,"passwordHash","fullName",role) VALUES ($1,$2,$3,$4,$5)`,
        [
          sites[i === 1 ? 1 : 0],
          emails[i],
          await hash(password, 4),
          'مدیر استودیو',
          i === 2 ? 'agent' : 'admin',
        ],
      );
      const response = await request.post('/v1/auth/login', {
        data: { email: emails[i], password },
      });
      expect(response.ok()).toBe(true);
      tokens.push((await response.json()).accessToken);
    }
  });
  test.afterAll(async () => {
    if (db) {
      await db.query('DELETE FROM sites WHERE id=ANY($1::uuid[])', [sites]);
      await db.end();
    }
  });

  test('validates configuration, preserves legacy values and isolates stores and permissions', async ({
    request,
  }) => {
    const headers = { Authorization: `Bearer ${tokens[0]}` };
    await db.query('UPDATE sites SET appearance=$2 WHERE id=$1', [
      sites[0],
      { color: '#223344', legacySecret: 'private', launcher: { futureOption: 'preserved' } },
    ]);
    const saved = await request.patch('/v1/sites/me', {
      headers,
      data: {
        appearance: {
          motion: { launcher: 'ripple', panel: 'scale' },
          features: { products: false },
          launcher: { label: 'پاپ موبایل' },
        },
      },
    });
    expect(saved.status()).toBe(200);
    const stored = (await db.query('SELECT appearance FROM sites WHERE id=$1', [sites[0]])).rows[0]
      .appearance;
    expect(stored).toMatchObject({
      color: '#223344',
      legacySecret: 'private',
      launcher: { label: 'پاپ موبایل', futureOption: 'preserved' },
      features: { products: false, sources: true },
    });
    const other = await request.get('/v1/sites/me', {
      headers: { Authorization: `Bearer ${tokens[1]}` },
    });
    expect((await other.json()).appearance.launcher).toBeUndefined();
    const publicSession = await request.post('/v1/widget/sessions', {
      headers: { Origin: origin },
      data: { widgetKey: keys[0] },
    });
    expect(publicSession.status()).toBe(200);
    const exposed = (await publicSession.json()).appearance;
    expect(exposed.legacySecret).toBeUndefined();
    expect(exposed.launcher.futureOption).toBeUndefined();
    expect(exposed.motion).toEqual({ launcher: 'ripple', panel: 'scale' });
    const denied = await request.patch('/v1/sites/me', {
      headers: { Authorization: `Bearer ${tokens[2]}` },
      data: { appearance: { color: '#ffffff' } },
    });
    expect(denied.status()).toBe(403);
    for (const appearance of [
      null,
      { motion: { panel: 'execute' } },
      {
        actions: [
          {
            id: 'bad',
            enabled: true,
            label: 'bad',
            hint: '',
            icon: 'external',
            type: 'link',
            value: 'javascript:alert(1)',
          },
        ],
      },
      { welcome: { html: '<script>bad</script>' } },
    ]) {
      expect(
        (await request.patch('/v1/sites/me', { headers, data: { appearance } })).status(),
      ).toBe(400);
    }
    expect(
      (await db.query('SELECT appearance FROM sites WHERE id=$1', [sites[0]])).rows[0].appearance,
    ).toEqual(stored);
  });

  test('previews without chat requests, publishes branding and motions and imports safely', async ({
    page,
    browser,
  }, info) => {
    const baseline = normalizeWidgetAppearance({});
    await db.query('UPDATE sites SET appearance=$2 WHERE id=$1', [sites[0], baseline]);
    const chatRequests: string[] = [];
    page.on('request', (request) => {
      if (/\/v1\/widget\//.test(request.url())) chatRequests.push(request.url());
    });
    await page.goto(dashboard);
    await page.locator('input[type="email"]').fill(emails[0]);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'ورود به داشبورد', exact: true }).click();
    await page.getByRole('button', { name: 'تنظیمات', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'بخش‌های تنظیمات', exact: true })
      .getByRole('button', { name: 'استودیو ویجت', exact: true })
      .click();
    const studio = page.getByRole('region', { name: 'استودیو ویجت', exact: true });
    const preview = page.frameLocator('iframe[title="پیش‌نمایش ویجت"]');
    await expect(preview.locator('.mira-panel')).toBeVisible();
    await studio.getByRole('button', { name: 'پاسخ نمونه', exact: true }).click();
    await expect(preview.locator('.mira-msg-bot')).toBeVisible();
    expect(chatRequests).toEqual([]);
    await studio.getByRole('button', { name: 'شروع دوباره پیش‌نمایش', exact: true }).click();
    await expect(preview.locator('.mira-welcome')).toBeVisible();
    await expect(preview.locator('.mira-msg-bot')).toHaveCount(0);
    await studio.getByRole('button', { name: 'ظاهر و حرکت', exact: true }).click();
    await studio.getByLabel('رنگ زمینه', { exact: true }).fill('#757575');
    await expect(preview.locator('.mira-panel')).toHaveCSS('--mira-surface', '#757575');
    await studio.getByLabel('رنگ زمینه', { exact: true }).fill('#ffffff');
    await studio.getByRole('button', { name: 'دکمه شناور', exact: true }).click();
    for (const value of ['none', 'breathe', 'float', 'ripple']) {
      await studio.getByLabel('انیمیشن دکمه شناور', { exact: true }).selectOption(value);
      await studio.getByRole('button', { name: 'اجرای دوباره انیمیشن', exact: true }).click();
      await expect(preview.locator('.mira-bubble')).toHaveAttribute('data-launcher-motion', value);
      const target = value === 'ripple' ? '::before' : undefined;
      await expect
        .poll(async () =>
          preview
            .locator('.mira-bubble')
            .evaluate((el, pseudo) => getComputedStyle(el, pseudo).animationName, target),
        )
        .toBe(value === 'none' ? 'none' : `mira-attention-${value}`);
    }
    await studio.getByLabel('انیمیشن دکمه شناور', { exact: true }).selectOption('float');
    await studio.getByLabel('انیمیشن پنجره', { exact: true }).selectOption('scale');
    await studio.getByRole('button', { name: 'اجرای دوباره انیمیشن', exact: true }).click();
    await studio.getByRole('button', { name: 'نمایش پنجره', exact: true }).click();
    await expect(preview.locator('.mira-panel')).toHaveAttribute('data-panel-motion', 'scale');
    const saved = page.waitForResponse(
      (r) => r.url().endsWith('/v1/sites/me') && r.request().method() === 'PATCH',
    );
    await studio.getByRole('button', { name: 'ذخیره و انتشار', exact: true }).click();
    expect((await saved).ok()).toBe(true);
    const stored = (await db.query('SELECT appearance FROM sites WHERE id=$1', [sites[0]])).rows[0]
      .appearance;
    expect(stored.motion).toEqual({ launcher: 'float', panel: 'scale' });
    const downloading = page.waitForEvent('download');
    await studio.getByRole('button', { name: 'خروجی قالب', exact: true }).click();
    const downloaded = JSON.parse(await readFile((await (await downloading).path())!, 'utf8'));
    expect(downloaded.format).toBe('mira-widget');
    expect(downloaded.appearance.motion).toEqual({ launcher: 'float', panel: 'scale' });
    expect(downloaded).not.toHaveProperty('siteId');
    await studio.getByLabel('ورود قالب', { exact: true }).setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"format":"mira-widget","version":"9.0.0","appearance":{}}'),
    });
    await expect(studio.getByRole('alert')).toBeVisible();
    const imported = normalizeWidgetAppearance({
      launcher: { label: 'راهنمای پاپ موبایل' },
      welcome: { title: 'به پاپ موبایل خوش آمدید', cards: [] },
      features: { products: false, sources: false },
      motion: { launcher: 'none', panel: 'reveal' },
    });
    await studio.getByLabel('ورود قالب', { exact: true }).setInputFiles({
      name: 'brand.json',
      mimeType: 'application/json',
      buffer: Buffer.from(exportWidgetTemplate(imported)),
    });
    expect(
      (await db.query('SELECT appearance FROM sites WHERE id=$1', [sites[0]])).rows[0].appearance,
    ).toEqual(stored);
    await studio.getByRole('button', { name: 'ذخیره و انتشار', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await db.query('SELECT appearance FROM sites WHERE id=$1', [sites[0]])).rows[0]
            .appearance.launcher.label,
      )
      .toBe('راهنمای پاپ موبایل');
    await info.attach('studio', {
      body: await page.screenshot({
        path: 'test-results/widget-studio.png',
        animations: 'disabled',
      }),
      contentType: 'image/png',
    });
    const visitor = await browser.newPage({ viewport: { width: 375, height: 812 } });
    try {
      await visitor.goto(`${origin}/chat.html?key=${keys[0]}`);
      await expect(visitor.locator('.mira-welcome h1')).toHaveText('به پاپ موبایل خوش آمدید');
      await expect(visitor.locator('.mira-intent')).toHaveCount(0);
      await visitor.emulateMedia({ reducedMotion: 'reduce' });
      expect(
        await visitor.locator('.mira-bubble').evaluate((el) => getComputedStyle(el).animationName),
      ).toBe('none');
      await info.attach('configured-mobile', {
        body: await visitor.screenshot({
          path: 'test-results/widget-studio-mobile.png',
          animations: 'disabled',
        }),
        contentType: 'image/png',
      });
    } finally {
      await visitor.close();
    }
  });
  test('uploads a brand image without losing drafts and publishes custom ordered blocks', async ({
    page,
    browser,
  }) => {
    await db.query('UPDATE sites SET appearance=$2 WHERE id=$1', [
      sites[0],
      normalizeWidgetAppearance({}),
    ]);
    await page.goto(dashboard);
    await page.locator('input[type="email"]').fill(emails[0]);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'ورود به داشبورد', exact: true }).click();
    await page.getByRole('button', { name: 'تنظیمات', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'بخش‌های تنظیمات', exact: true })
      .getByRole('button', { name: 'استودیو ویجت', exact: true })
      .click();
    const studio = page.getByRole('region', { name: 'استودیو ویجت', exact: true });
    await studio.getByLabel('نام دستیار', { exact: true }).fill('دستیار برند آزمایشی');
    await page.getByRole('button', { name: 'گفتگوها', exact: true }).click();
    await page.getByRole('button', { name: 'تنظیمات', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'بخش‌های تنظیمات', exact: true })
      .getByRole('button', { name: 'استودیو ویجت', exact: true })
      .click();
    await expect(studio.getByLabel('نام دستیار', { exact: true })).toHaveValue(
      'دستیار برند آزمایشی',
    );
    const image = await sharp({
      create: { width: 320, height: 320, channels: 3, background: '#145c47' },
    })
      .png()
      .toBuffer();
    await studio
      .getByLabel('لوگو یا تصویر دستیار', { exact: true })
      .setInputFiles({ name: 'brand.png', mimeType: 'image/png', buffer: image });
    await studio.getByRole('button', { name: 'تأیید برش و ذخیره عکس', exact: true }).click();
    await expect(
      studio.getByRole('group', { name: 'برش دایره‌ای تصویر', exact: true }),
    ).toHaveCount(0);
    await expect(studio.getByLabel('نام دستیار', { exact: true })).toHaveValue(
      'دستیار برند آزمایشی',
    );
    await studio.getByRole('button', { name: 'بلوک‌ها و میان‌برها', exact: true }).click();
    await studio.getByLabel('عنوان کارت ۱', { exact: true }).fill('X'.repeat(48));
    const frame = page.frameLocator('iframe[title="پیش‌نمایش ویجت"]');
    await expect(frame.locator('.mira-intent strong').first()).toHaveText('X'.repeat(48));
    expect(
      await frame
        .locator('.mira-intent strong')
        .first()
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await studio.getByLabel('عنوان کارت ۱', { exact: true }).fill('انتخاب قاب گوشی');
    await studio
      .getByLabel('متن عملکرد کارت ۱', { exact: true })
      .fill('برای انتخاب قاب گوشی راهنمایی می‌خواهم.');
    await studio.getByRole('button', { name: 'پایین بردن کارت ۱', exact: true }).click();
    await studio.getByRole('button', { name: 'امکانات', exact: true }).click();
    await studio.getByLabel('کپی پاسخ', { exact: true }).uncheck();
    await studio.getByLabel('حالت تمام‌صفحه', { exact: true }).uncheck();
    await studio.getByRole('button', { name: 'ذخیره و انتشار', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await db.query('SELECT "aiBotName" FROM sites WHERE id=$1', [sites[0]])).rows[0]
            .aiBotName,
      )
      .toBe('دستیار برند آزمایشی');
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const visitor = await browser.newPage();
    try {
      await visitor.goto(`${origin}/chat.html?key=${keys[0]}`);
      await expect(visitor.locator('.mira-header-title')).toHaveText('دستیار برند آزمایشی');
      await expect(visitor.locator('.mira-header-logo img')).toBeVisible();
      await expect(visitor.locator('.mira-intent').nth(1)).toContainText('انتخاب قاب گوشی');
      await expect(visitor.locator('.mira-expand')).toBeHidden();
      const started = visitor.waitForResponse(
        (r) => r.url().endsWith('/v1/widget/conversations') && r.request().method() === 'POST',
      );
      await visitor.getByRole('button', { name: /انتخاب قاب گوشی/ }).click();
      const conversationId = (await (await started).json()).conversationId;
      await expect(visitor.locator('.mira-msg-visitor')).toContainText(
        'برای انتخاب قاب گوشی راهنمایی می‌خواهم.',
      );
      expect(
        (
          await db.query(
            'SELECT content FROM messages WHERE "siteId"=$1 AND "conversationId"=$2 AND "senderType"=$3',
            [sites[0], conversationId, 'visitor'],
          )
        ).rows[0].content,
      ).toBe('برای انتخاب قاب گوشی راهنمایی می‌خواهم.');
    } finally {
      await visitor.close();
    }
  });
});
