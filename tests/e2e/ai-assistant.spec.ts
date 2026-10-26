import { expect, test } from '@playwright/test';
import { DEFAULT_AI_POLICY } from '@mira/shared-types';
import { Client } from 'pg';
import { readFile, writeFile, unlink } from 'node:fs/promises';

const dashboardUrl = process.env.E2E_DASHBOARD_URL || 'http://localhost:5173';
test.describe('AI assistant through the live queue', () => {
  test.skip(process.env.AI_E2E !== '1', 'Requires the fixture provider and worker');
  let token: string;
  let original: Record<string, unknown>;
  test.beforeAll(async ({ request }) => {
    const login = await request.post('/v1/auth/login', {
      data: {
        email: process.env.E2E_ADMIN_EMAIL || 'admin@kgkala.test',
        password: process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!',
      },
    });
    expect(login.ok()).toBe(true);
    token = (await login.json()).accessToken;
    original = await (
      await request.get('/v1/sites/me', { headers: { Authorization: `Bearer ${token}` } })
    ).json();
    const saved = await request.patch('/v1/sites/me', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        aiEnabled: true,
        aiReplyOnlyOutsideBusinessHours: false,
        aiBotName: 'دستیار فروش میرا',
        aiPolicy: {
          ...DEFAULT_AI_POLICY,
          useKnowledgeBase: false,
          serverContext: 'ارسال سفارش دو روز کاری زمان می‌برد.',
        },
      },
    });
    expect(saved.ok()).toBe(true);
  });
  test.afterAll(async ({ request }) => {
    if (!original) return;
    await request.patch('/v1/sites/me', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        aiEnabled: original.aiEnabled,
        aiReplyOnlyOutsideBusinessHours: original.aiReplyOnlyOutsideBusinessHours,
        aiBotName: original.aiBotName,
        aiPolicy: original.aiPolicy,
        name: original.name,
      },
    });
  });

  test('shows thinking, sources, one persisted answer, and a durable human handoff', async ({
    page,
    request,
  }, testInfo) => {
    await page.goto('/demo.html');
    await page.locator('.mira-bubble').click();
    await expect(page.locator('.mira-header-title')).toHaveText('دستیار فروش میرا');
    await page.locator('.mira-input').fill('شرایط ارسال سفارش چیست؟');
    await page.locator('.mira-send').click();
    await expect(page.locator('.mira-ai-status')).toContainText('در حال');
    await testInfo.attach('widget-thinking', {
      body: await page.screenshot({ path: 'test-results/widget-thinking.png' }),
      contentType: 'image/png',
    });
    await expect(page.locator('.mira-msg-bot')).toHaveCount(1);
    await expect(page.locator('.mira-msg-bot')).toContainText('دو روز کاری');
    await expect(page.locator('.mira-source')).toContainText('اطلاعات تأییدشده فروشگاه');
    await expect(page.locator('.mira-ai-status')).toBeEmpty();
    await testInfo.attach('widget-answer', {
      body: await page.screenshot({ path: 'test-results/widget-answer.png' }),
      contentType: 'image/png',
    });
    const usage = await request.get('/v1/ai/billing/usage?days=7', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(usage.ok()).toBe(true);
    const report = await usage.json();
    expect(report.totalTokens).toBeGreaterThanOrEqual(140);
    expect(report.users).toBeGreaterThanOrEqual(1);
    expect(
      report.visitors.some((visitor: { totalTokens: number }) => visitor.totalTokens >= 140),
    ).toBe(true);
    const invalid = await request.get('/v1/ai/billing/usage?days=999', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(invalid.status()).toBe(400);
    await page.reload();
    await page.locator('.mira-bubble').click();
    await expect(page.locator('.mira-msg-bot')).toHaveCount(1);
    await page.locator('.mira-human').click();
    await expect(page.locator('.mira-msg-bot')).toHaveCount(2);
    await page.locator('.mira-input').fill('باز هم درباره ارسال سوال دارم');
    await page.locator('.mira-send').click();
    await expect(page.locator('.mira-msg-visitor')).toHaveCount(3);
    await page.waitForTimeout(2000);
    await expect(page.locator('.mira-msg-bot')).toHaveCount(2);
  });

  test('keeps AI active while an operator watches and supports explicit takeover and resume', async ({
    page,
    browser,
    request,
  }) => {
    const visitor = await browser.newPage();
    try {
      await page.goto(process.env.E2E_DASHBOARD_URL || 'http://localhost:5173');
      await page
        .locator('input[type="email"]')
        .fill(process.env.E2E_ADMIN_EMAIL || 'admin@kgkala.test');
      await page
        .locator('input[type="password"]')
        .fill(process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!');
      await page.getByRole('button', { name: 'ورود به داشبورد', exact: true }).click();
      await expect(page.locator('#store-switch')).toBeVisible();
      await visitor.goto(`${process.env.E2E_API_URL || 'http://localhost:3000'}/demo.html`);
      await visitor.locator('.mira-bubble').click();
      const started = visitor.waitForResponse(
        (r) => r.url().endsWith('/v1/widget/conversations') && r.request().method() === 'POST',
      );
      await visitor.locator('.mira-input').fill('سلام وقت بخیر');
      await visitor.locator('.mira-send').click();
      const id = (await (await started).json()).conversationId;
      await page.locator(`[data-conversation-id="${id}"]`).click();
      const state = page.getByRole('status', { name: 'کنترل پاسخ‌گویی', exact: true });
      await expect(state).toContainText('هوش مصنوعی فعال');
      const headers = { Authorization: `Bearer ${token}` };
      expect(
        await (await request.get(`/v1/conversations/${id}`, { headers })).json(),
      ).toMatchObject({ assignedAgentId: null, aiPaused: false, status: 'open' });
      await expect(visitor.locator('.mira-msg-bot')).toHaveCount(1);
      expect(
        await (await request.get(`/v1/conversations/${id}`, { headers })).json(),
      ).toMatchObject({ aiPaused: false });
      const db = new Client({
        connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      });
      await db.connect();
      try {
        expect(
          Number(
            (
              await db.query(
                'SELECT count(*) FROM ai_usage WHERE "conversationId"=$1 AND "siteId"=$2',
                [id, original.id],
              )
            ).rows[0].count,
          ),
        ).toBe(0);
      } finally {
        await db.end();
      }
      await visitor.locator('.mira-input').fill('شرایط ارسال سفارش چیست؟');
      await visitor.locator('.mira-send').click();
      await expect(visitor.locator('.mira-msg-bot')).toHaveCount(2);
      await page
        .getByLabel('پاسخ به بازدیدکننده', { exact: true })
        .fill('پاسخ پشتیبان برای تست تحویل گفتگو');
      await page.getByRole('button', { name: 'ارسال', exact: true }).click();
      await expect(visitor.locator('.mira-msg-agent')).toHaveCount(1);
      await expect(state).toContainText('AI متوقف است');
      const taken = await (await request.get(`/v1/conversations/${id}`, { headers })).json();
      expect(taken.aiPaused).toBe(true);
      expect(taken.assignedAgentId).toBeTruthy();
      await page.getByRole('button', { name: 'بازگردانی به AI', exact: true }).click();
      await expect(state).toContainText('هوش مصنوعی فعال');
      await visitor.locator('.mira-input').fill('ارسال سفارش چند روز طول می‌کشد؟');
      await visitor.locator('.mira-send').click();
      await expect(visitor.locator('.mira-msg-bot')).toHaveCount(3);
    } finally {
      await visitor.close();
    }
  });

  test('validates policy and saves it from the admin panel', async ({ page, request }) => {
    for (const name of ['', '   ', null, 'x'.repeat(256)]) {
      const rejected = await request.patch('/v1/sites/me', {
        headers: { Authorization: `Bearer ${token}` },
        data: { name },
      });
      expect(rejected.status()).toBe(400);
    }
    for (const aiPolicy of [
      null,
      { ...DEFAULT_AI_POLICY, maxProducts: 100 },
      { ...DEFAULT_AI_POLICY, useProducts: 'yes' },
    ]) {
      const rejected = await request.patch('/v1/sites/me', {
        headers: { Authorization: `Bearer ${token}` },
        data: { aiPolicy },
      });
      expect(rejected.status()).toBe(400);
    }
    await page.goto(dashboardUrl);
    await page
      .locator('input[type="email"]')
      .fill(process.env.E2E_ADMIN_EMAIL || 'admin@kgkala.test');
    await page
      .locator('input[type="password"]')
      .fill(process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!');
    await page.locator('button[type="submit"]').click();
    await page.getByRole('button', { name: 'تنظیمات', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'بخش‌های تنظیمات', exact: true })
      .getByRole('button', { name: 'هزینه و مصرف', exact: true })
      .click();
    const billing = page.getByRole('region', { name: 'هزینه و اعتبار آوالای' });
    await expect(billing.getByRole('heading', { name: 'مصرف کاربران میرا' })).toBeVisible();
    await expect(billing.getByRole('columnheader', { name: 'کل توکن', exact: true })).toBeVisible();
    await billing.getByLabel('بازه گزارش').selectOption('30');
    await expect(billing.getByText('کل توکن‌های ثبت‌شده', { exact: true })).toBeVisible();
    await expect(billing.getByRole('link', { name: 'شارژ و پرداخت سریع ↗' })).toHaveAttribute(
      'href',
      'https://chat.avalai.ir/platform/billing',
    );
    await billing.scrollIntoViewIfNeeded();
    await billing.screenshot({ path: 'test-results/ai-billing.png' });
    await page
      .getByRole('navigation', { name: 'بخش‌های تنظیمات', exact: true })
      .getByRole('button', { name: 'هوش مصنوعی', exact: true })
      .click();
    const section = page.getByRole('region', { name: 'مرکز هوش مصنوعی' });
    await section.getByLabel('نام فروشگاه', { exact: false }).fill('فروشگاه نمونه میرا');
    await section.getByRole('button', { name: 'گاردریل‌ها', exact: true }).click();
    await section.getByLabel('موضوع‌های ممنوع', { exact: false }).fill('اطلاعات حساب دیگران');
    const [updatedResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith('/v1/sites/me') && response.request().method() === 'PATCH',
      ),
      section.getByRole('button', { name: 'ذخیره تنظیمات AI' }).click(),
    ]);
    expect(updatedResponse.ok()).toBe(true);
    const updatedSettings = await updatedResponse.json();
    expect(Array.isArray(updatedSettings.allowedDomains)).toBe(true);
    expect(updatedSettings.appearance).toBeTruthy();
    await expect(section.getByRole('status')).toContainText('ذخیره شد');
    const saved = await (
      await request.get('/v1/sites/me', { headers: { Authorization: `Bearer ${token}` } })
    ).json();
    expect(saved.aiPolicy.blockedTopics).toEqual(['اطلاعات حساب دیگران']);
    expect(saved.name).toBe('فروشگاه نمونه میرا');
    expect(saved.wordpressApiKey).toBeNull();
    await section.locator('header').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/ai-settings.png' });
    await section.getByRole('button', { name: 'منابع و محصولات', exact: true }).click();
    await section.getByLabel('پیشنهاد محصول با کارت خرید', { exact: false }).check();
    await section.locator('header').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/ai-sources.png' });
  });

  test('fits mobile and respects reduced motion', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/demo.html');
    await page.locator('.mira-bubble').click();
    const bounds = await page.locator('.mira-panel').boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
    await page.locator('.mira-input').fill('شرایط ارسال چیست؟');
    await page.locator('.mira-send').click();
    await expect(page.locator('.mira-thinking')).toBeVisible();
    await expect(page.locator('.mira-thinking')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.mira-msg-bot')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/ai-mobile.png' });
  });

  test('renders persisted product cards and rejects unsafe links', async ({ page }) => {
    await page.goto('/demo.html');
    await page.locator('.mira-bubble').click();
    await page.locator('.mira-input').fill('راهنمای محصول می‌خواهم');
    const started = page.waitForResponse((res) => res.url().endsWith('/v1/widget/conversations'));
    await page.locator('.mira-send').click();
    const conversationId = (await (await started).json()).conversationId;
    await expect(page.locator('.mira-msg-bot')).toHaveCount(1);
    const db = new Client({
      connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    });
    await db.connect();
    try {
      const siteId = (await db.query(`SELECT id FROM sites WHERE "widgetKey" = 'kgkala-demo-key'`))
        .rows[0].id;
      const product = {
        id: 'fixture-product',
        name: 'کابل شارژ سریع USB-C',
        url: 'https://shop.example.test/cable',
        imageUrl: null,
        price: '125000',
        currency: 'IRT',
        inStock: true,
      };
      await db.query(
        `INSERT INTO messages ("siteId", "conversationId", "senderType", content, "aiMetadata") VALUES ($1, $2, 'bot', 'این محصول را بررسی کنید.', $3)`,
        [
          siteId,
          conversationId,
          {
            products: [product, { ...product, id: 'unsafe', url: 'javascript:alert(1)' }],
            sources: [
              { id: 'fixture', title: 'راهنمای فروشگاه', url: 'https://shop.example.test/help' },
            ],
          },
        ],
      );
      await page.reload();
      await page.locator('.mira-bubble').click();
      await expect(page.locator('.mira-product')).toHaveCount(1);
      await expect(page.locator('.mira-product')).toContainText('۱۲۵٬۰۰۰ تومان');
      await expect(page.locator('.mira-product')).toHaveAttribute('href', product.url);
      await page.screenshot({ path: 'test-results/ai-products.png' });
    } finally {
      await db.end();
    }
  });

  test('keeps two live widgets and queued answers under their own store names', async ({
    browser,
  }) => {
    const db = new Client({
      connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    });
    await db.connect();
    const sites: string[] = [];
    try {
      for (const name of ['فروشگاه آبی', 'فروشگاه سبز']) {
        const key = crypto.randomUUID();
        const siteId = (
          await db.query(
            `INSERT INTO sites (name, "widgetKey", "allowedDomains", "aiEnabled", "aiReplyOnlyOutsideBusinessHours", "aiPolicy") VALUES ($1, $2, $3, true, false, $4) RETURNING id`,
            [
              name,
              key,
              [new URL(process.env.E2E_API_URL || 'http://localhost:3000').origin],
              {
                ...DEFAULT_AI_POLICY,
                useKnowledgeBase: false,
                serverContext: 'ارسال سفارش دو روز کاری زمان می‌برد.',
              },
            ],
          )
        ).rows[0].id;
        sites.push(siteId);
        const context = await browser.newContext();
        const fixturePath = `apps/api/public/widget-dist/store-${key}.html`;
        try {
          const page = await context.newPage();
          // صفحه از HTTP واقعی می‌آید؛ پاسخ مصنوعی route در Chromium جدید اتصال محلی سوکت را مسدود می‌کند.
          await writeFile(
            fixturePath,
            (await readFile('apps/api/public/demo.html', 'utf8')).replace('kgkala-demo-key', key),
          );
          await page.goto(`/widget-dist/store-${key}.html`);
          await page.locator('.mira-bubble').click();
          await expect(page.locator('.mira-header-sub')).toContainText(name);
          await page.locator('.mira-input').fill('شرایط ارسال چیست؟');
          await page.locator('.mira-send').click();
          await expect(page.locator('.mira-msg-bot')).toContainText(name);
          await expect(page.locator('.mira-msg-bot')).not.toContainText(
            name === 'فروشگاه آبی' ? 'فروشگاه سبز' : 'فروشگاه آبی',
          );
          await page.screenshot({ path: `test-results/ai-store-${sites.length}.png` });
        } finally {
          await context.close();
          await unlink(fixturePath).catch(() => undefined);
        }
      }
    } finally {
      for (const table of ['messages', 'conversations', 'visitors'])
        await db.query(`DELETE FROM ${table} WHERE "siteId" = ANY($1::uuid[])`, [sites]);
      await db.query('DELETE FROM sites WHERE id = ANY($1::uuid[])', [sites]);
      await db.end();
    }
  });
});
