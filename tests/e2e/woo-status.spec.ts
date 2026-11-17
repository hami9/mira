import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { hash } from 'bcryptjs';

const api = process.env.E2E_API_URL || 'http://localhost:3000';
const dashboard = process.env.E2E_DASHBOARD_URL || 'http://localhost:5173';
const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

test('WooCommerce diagnostics use saved tenant settings and fresh permissions', async ({
  page,
  request,
}) => {
  test.skip(!databaseUrl, 'Requires a disposable database');
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  let siteId: string | undefined;
  const suffix = crypto.randomUUID();
  const password = 'Woo-fixture-only-123!';
  const email = `admin-${suffix}@woo.test`;
  try {
    siteId = (
      await db.query(
        `INSERT INTO sites(name,"widgetKey","aiEnabled") VALUES('اتصال آزمایشی',$1,false) RETURNING id`,
        [suffix],
      )
    ).rows[0].id;
    const passwordHash = await hash(password, 4);
    for (const role of ['admin', 'agent']) {
      await db.query(
        `INSERT INTO agents("siteId",email,"passwordHash","fullName",role) VALUES($1,$2,$3,'حساب آزمایشی',$4)`,
        [siteId, `${role}-${suffix}@woo.test`, passwordHash, role],
      );
    }
    const login = await request.post(`${api}/v1/auth/login`, {
      data: { email: `agent-${suffix}@woo.test`, password },
    });
    expect(login.ok()).toBe(true);
    const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` };
    expect((await request.get(`${api}/v1/wordpress/status`, { headers })).status()).toBe(403);
    await db.query(`UPDATE agents SET permissions=$1 WHERE "siteId"=$2 AND role='agent'`, [
      JSON.stringify({ manageSiteSettings: true }),
      siteId,
    ]);
    const granted = await request.get(`${api}/v1/wordpress/status`, { headers });
    expect(granted.status()).toBe(200);
    expect(granted.headers()['cache-control']).toBe('no-store');
    expect(await granted.json()).toEqual({ status: 'not-configured' });
    await db.query(`UPDATE agents SET permissions='{}' WHERE "siteId"=$1 AND role='agent'`, [
      siteId,
    ]);
    expect((await request.get(`${api}/v1/wordpress/status`, { headers })).status()).toBe(403);

    await page.goto(dashboard);
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(password);
    await page.getByRole('button', { name: 'ورود به داشبورد', exact: true }).click();
    await expect(page.locator('#store-switch')).toBeVisible();
    await page.getByRole('button', { name: 'تنظیمات', exact: true }).click();
    await page.getByRole('button', { name: 'نصب و اتصال', exact: true }).click();
    await page.getByLabel('رنگ‌بندی داشبورد', { exact: true }).selectOption('dark');
    await page.setViewportSize({ width: 375, height: 900 });
    await page.getByRole('button', { name: 'آزمایش اتصال', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(
      'ابتدا نشانی وردپرس و کلید مشترک افزونه را ذخیره کنید.',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await db.query(
      `UPDATE sites SET "wordpressSiteUrl"='http://127.0.0.1:3000',"wordpressApiKey"='fixture-only' WHERE id=$1`,
      [siteId],
    );
    await page.getByRole('button', { name: 'آزمایش اتصال', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('وردپرس پاسخ معتبر نداد.');
    await page.screenshot({ path: 'test-results/woo-status-dark.png', fullPage: true });
  } finally {
    if (siteId) await db.query('DELETE FROM sites WHERE id=$1', [siteId]);
    await db.end();
  }
});
