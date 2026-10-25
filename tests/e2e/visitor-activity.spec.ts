import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { hash } from 'bcryptjs';

test('opens a visitor conversation and keeps current and entry pages distinct on desktop and mobile', async ({
  page,
  browser,
}, testInfo) => {
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  test.skip(!databaseUrl, 'Requires disposable tenant fixtures');
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  const apiUrl = process.env.E2E_API_URL || 'http://localhost:3000';
  const dashboardUrl = process.env.E2E_DASHBOARD_URL || 'http://localhost:5173';
  const key = crypto.randomUUID();
  const email = `${key}@activity.test`;
  const password = 'Activity-fixture-only-123!';
  let siteId: string | undefined;
  const visitor = await browser.newPage();
  try {
    siteId = (
      await db.query(
        `INSERT INTO sites (name,"widgetKey","allowedDomains","aiEnabled") VALUES ('فروشگاه مسیر مشتری',$1,ARRAY[$2],false) RETURNING id`,
        [key, new URL(apiUrl).origin],
      )
    ).rows[0].id;
    await db.query(
      `INSERT INTO agents ("siteId",email,"passwordHash","fullName",role) VALUES ($1,$2,$3,'اپراتور تست','admin')`,
      [siteId, email, await hash(password, 4)],
    );
    await page.goto(dashboardUrl);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'ورود به داشبورد', exact: true }).click();
    await expect(page.locator('#store-switch')).toBeVisible();
    const entryUrl = `${apiUrl}/chat.html?key=${key}`;
    await visitor.goto(entryUrl);
    await expect(visitor.locator('.mira-panel.mira-open')).toBeVisible();
    await page.getByRole('button', { name: 'بازدیدکنندگان آنلاین', exact: true }).click();
    const row = page.locator('[data-visitor-id]');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('صفحهٔ فعلی');
    await expect(row.locator(`a[href="${entryUrl}"]`)).toBeVisible();
    await row.getByRole('button', { name: 'شروع گفتگو', exact: true }).click();
    await expect(page.getByRole('region', { name: 'پنجرهٔ گفتگو' })).toBeVisible();
    if (
      (await page
        .getByRole('button', { name: 'اطلاعات و مسیر بازدید', exact: true })
        .getAttribute('aria-expanded')) === 'false'
    )
      await page.getByRole('button', { name: 'اطلاعات و مسیر بازدید', exact: true }).click();
    const info = page.getByRole('complementary', { name: 'اطلاعات بازدیدکننده' });
    await expect(info).toContainText('صفحهٔ آغاز گفتگو');
    await visitor.evaluate(() => {
      history.pushState({}, '', '/products/activity-fixture');
      document.title = 'محصول جدید مشتری';
    });
    await expect(info.getByRole('link', { name: 'محصول جدید مشتری ↗', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(info.getByRole('link', { name: 'گفتگوی پشتیبانی ↗', exact: true })).toBeVisible();
    const conversationId = (
      await db.query(`SELECT id FROM conversations WHERE "siteId"=$1`, [siteId])
    ).rows[0].id;
    const entry = (
      await db.query(`SELECT "entryPage" FROM conversations WHERE id=$1 AND "siteId"=$2`, [
        conversationId,
        siteId,
      ])
    ).rows[0].entryPage;
    expect(entry.url).toBe(entryUrl);
    await page.getByRole('button', { name: 'بستن اطلاعات بازدیدکننده', exact: true }).click();
    const composer = page.getByRole('textbox', { name: 'پاسخ به بازدیدکننده', exact: true });
    await composer.fill('سلام، برای انتخاب محصول راهنمایی می‌خواهید؟');
    await composer.press('Shift+Enter');
    await composer.pressSequentially('در خدمت شما هستم.');
    await composer.press('Enter');
    await expect(visitor.locator('.mira-msg-agent')).toContainText('در خدمت شما هستم.');
    await expect(composer).toHaveValue('');
    await page.getByRole('button', { name: 'اطلاعات و مسیر بازدید', exact: true }).click();
    await testInfo.attach('visitor-activity-desktop', {
      body: await page.screenshot({ path: 'test-results/visitor-activity-desktop.png' }),
      contentType: 'image/png',
    });
    await page.getByRole('button', { name: 'بستن اطلاعات بازدیدکننده', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(composer).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await testInfo.attach('visitor-activity-mobile', {
      body: await page.screenshot({ path: 'test-results/visitor-activity-mobile.png' }),
      contentType: 'image/png',
    });
    await page.getByRole('button', { name: 'همه‌ی بازدیدکنندگان', exact: true }).click();
    await expect(page.locator('[data-visitor-id]')).toContainText('محصول جدید مشتری');
    await page
      .locator('[data-visitor-id]')
      .getByRole('button', { name: 'بازکردن گفتگو', exact: true })
      .click();
    await expect(composer).toBeVisible();
    expect(
      (
        await db.query(`SELECT COUNT(*)::int AS count FROM conversations WHERE "siteId"=$1`, [
          siteId,
        ])
      ).rows[0].count,
    ).toBe(1);
  } finally {
    await visitor.close();
    if (siteId) await db.query('DELETE FROM sites WHERE id=$1', [siteId]);
    await db.end();
  }
});
