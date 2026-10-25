import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from 'pg';
import { parse } from 'dotenv';
import { createServer, request as proxyRequest } from 'node:http';

test.describe('hosting installation', () => {
  test.skip(process.env.HOSTING_E2E !== '1', 'Requires the compiled hosting launcher');

  test('generates a private configuration locally without network requests', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) requests.push(request.url());
    });
    await page.goto(pathToFileURL(resolve('package/hosting/configure.html')).href);
    await page.locator('[name="publicUrl"]').fill('https://chat.example.com');
    await page.locator('[name="shopUrl"]').fill('https://shop.example.com');
    await page.locator('[name="siteName"]').fill('فروشگاه آزمایشی');
    await page.locator('[name="email"]').fill('fixture@example.test');
    await page.locator('[name="password"]').fill('Fixture-only-1234!');
    await page
      .locator('[name="database"]')
      .fill('postgresql://fixture:fixture@localhost:5432/fixture');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ساخت و دریافت فایل تنظیمات' }).click();
    const file = await download;
    const env = parse(await readFile((await file.path())!));
    expect(env.SEED_SITE_NAME).toBe('فروشگاه آزمایشی');
    expect(env.SEED_ADMIN_PASSWORD).toBe('Fixture-only-1234!');
    expect(env.JWT_ACCESS_SECRET).toHaveLength(64);
    expect(env.JWT_ACCESS_SECRET).not.toBe(env.JWT_REFRESH_SECRET);
    expect(env.SEED_ALLOWED_DOMAINS).toContain('https://chat.example.com');
    expect(requests).toEqual([]);
    expect(await page.locator('body').innerText()).not.toContain(env.JWT_ACCESS_SECRET);
  });

  test('runs dashboard, direct chat, polling fallback and live messages on one address', async ({
    page,
    request,
    browser,
  }) => {
    const login = await request.post('/v1/auth/login', {
      data: {
        email: process.env.E2E_ADMIN_EMAIL || 'admin@kgkala.test',
        password: process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!',
      },
    });
    expect(login.ok()).toBe(true);
    const { accessToken } = await login.json();
    const headers = { Authorization: `Bearer ${accessToken}` };
    const settings = await (await request.get('/v1/sites/me', { headers })).json();
    const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
    let visitorRef: string | undefined;
    let visitor: Awaited<ReturnType<typeof browser.newPage>> | undefined;
    let upgradeAttempts = 0;
    let pollingRequests = 0;
    const backend = new URL(process.env.E2E_API_URL || 'http://localhost:4300');
    const proxy = createServer((req, res) => {
      if (req.url?.includes('transport=polling')) pollingRequests++;
      const upstream = proxyRequest(
        {
          hostname: backend.hostname === 'localhost' ? '127.0.0.1' : backend.hostname,
          port: backend.port,
          path: req.url,
          method: req.method,
          headers: req.headers,
        },
        (response) => {
          res.writeHead(response.statusCode || 502, response.headers);
          response.pipe(res);
        },
      );
      upstream.on('error', () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
    });
    // میزبان واقعی آزمایشی: HTTP عبور می‌کند ولی handshake وب‌سوکت رد می‌شود.
    proxy.on('upgrade', (_req, socket) => {
      upgradeAttempts++;
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    });
    await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));
    const proxyOrigin = `http://127.0.0.1:${(proxy.address() as import('node:net').AddressInfo).port}`;
    try {
      const health = await request.get('/health');
      expect(health.ok()).toBe(true);
      const hidden = await request.get('/.env');
      expect(hidden.status()).toBe(404);
      expect((await request.get('/demo.html')).status()).toBe(404);
      const systemResponse = await request.get('/v1/system', { headers });
      expect(systemResponse.ok()).toBe(true);
      const status = await systemResponse.json();
      expect(status.authorized).toBe(true);
      expect(status.api.rssBytes).toBeGreaterThan(0);
      expect(status.worker.rssBytes).toBeGreaterThan(0);
      expect(status.databaseBytes).toBeGreaterThan(0);
      expect(status.limits.workerConcurrency).toBe(2);

      await page.goto('/');
      await page
        .locator('input[type="email"]')
        .fill(process.env.E2E_ADMIN_EMAIL || 'admin@kgkala.test');
      await page
        .locator('input[type="password"]')
        .fill(process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!');
      await page.locator('button[type="submit"]').click();
      await expect(page.locator('aside')).toBeVisible();
      await page.getByRole('button', { name: 'تنظیمات', exact: true }).click();
      await page
        .getByRole('navigation', { name: 'بخش‌های تنظیمات', exact: true })
        .getByRole('button', { name: 'نصب و اتصال', exact: true })
        .click();
      await expect(
        page.getByRole('heading', { name: 'نصب و شخصی‌سازی', exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'افزودن دامنه میرا برای فعال‌کردن لینک گفتگو' })
        .click();
      await page.getByLabel('رنگ ویجت', { exact: true }).fill('#17b8a6');
      const [saved] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().endsWith('/v1/sites/me') && response.request().method() === 'PATCH',
        ),
        page.getByRole('button', { name: 'ذخیره ظاهر و دامنه‌ها' }).click(),
      ]);
      expect(saved.ok()).toBe(true);
      const customized = await saved.json();
      expect(customized.allowedDomains).toContain(
        new URL(process.env.E2E_API_URL || 'http://localhost:4300').origin,
      );
      expect(customized.appearance.color).toBe('#17b8a6');
      await page
        .getByRole('region', { name: 'نصب و شخصی‌سازی' })
        .screenshot({ path: 'test-results/hosting-install.png' });
      await page
        .getByRole('navigation', { name: 'بخش‌های تنظیمات', exact: true })
        .getByRole('button', { name: 'سیستم', exact: true })
        .click();
      await page.getByRole('button', { name: 'بررسی منابع', exact: true }).click();
      await expect(page.getByText('حافظه API', { exact: true })).toBeVisible();
      await page
        .getByRole('region', { name: 'منابع سیستم' })
        .screenshot({ path: 'test-results/hosting-resources.png' });

      await db.query(`UPDATE sites SET "allowedDomains" = $2 WHERE id = $1`, [
        settings.id,
        [...customized.allowedDomains, proxyOrigin],
      ]);
      visitor = await browser.newPage({ viewport: { width: 390, height: 700 } });
      visitor.on('response', async (response) => {
        if (response.url().includes('/v1/widget/sessions') && response.ok())
          visitorRef = (await response.json()).visitorRef;
      });
      await visitor.goto(`${proxyOrigin}/chat.html?key=${encodeURIComponent(settings.widgetKey)}`);
      await expect(visitor.locator('.mira-panel')).toBeVisible();
      await expect(visitor.locator('.mira-panel')).toHaveCSS('--mira-color', '#17b8a6');
      await expect(visitor.locator('.mira-input')).toBeEnabled();
      const message = `hosting-${crypto.randomUUID()}`;
      await visitor.locator('.mira-input').fill(message);
      await expect(visitor.locator('.mira-send')).toBeEnabled({ timeout: 30_000 });
      await visitor.locator('.mira-send').click();
      await expect(visitor.locator('.mira-msg-visitor')).toContainText(message);
      const rows = await db.query(
        `SELECT m.content FROM messages m JOIN conversations c ON c.id = m."conversationId" AND c."siteId" = m."siteId" JOIN visitors v ON v.id = c."visitorId" AND v."siteId" = c."siteId" WHERE m."siteId" = $1 AND v."visitorRef" = $2 AND m.content = $3`,
        [settings.id, visitorRef, message],
      );
      expect(rows.rowCount).toBe(1);
      expect(upgradeAttempts).toBeGreaterThan(0);
      expect(pollingRequests).toBeGreaterThan(0);
      await visitor.screenshot({ path: 'test-results/hosting-chat.png' });
    } finally {
      await visitor?.close();
      proxy.closeAllConnections();
      await new Promise<void>((resolve) => proxy.close(() => resolve()));
      await db.query(`UPDATE sites SET "allowedDomains" = $2 WHERE id = $1`, [
        settings.id,
        settings.allowedDomains,
      ]);
      await db.query(`UPDATE sites SET appearance = $2 WHERE id = $1`, [
        settings.id,
        settings.appearance,
      ]);
      if (visitorRef)
        await db.query(`DELETE FROM visitors WHERE "siteId" = $1 AND "visitorRef" = $2`, [
          settings.id,
          visitorRef,
        ]);
      await db.end();
    }
  });
});
