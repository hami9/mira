import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { hash } from 'bcryptjs';
const dashboard = process.env.E2E_DASHBOARD_URL || 'http://localhost:5173';

test('dashboard theme follows system and explicit persisted choice across pages and dialogs', async ({
  page,
  context,
}, info) => {
  test.setTimeout(150000);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(dashboard);
  const theme = page.getByLabel('رنگ‌بندی داشبورد', { exact: true });
  await expect(theme).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await theme.selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await theme.selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await theme.selectOption('dark');
  const second = await context.newPage();
  await second.goto(dashboard);
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
  await second.getByLabel('رنگ‌بندی داشبورد', { exact: true }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await second.close();
  await theme.selectOption('dark');
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  test.skip(!databaseUrl, 'Authenticated checks require disposable fixtures');
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  let siteId: string | undefined;
  try {
    const key = crypto.randomUUID();
    const email = key + '@theme.test';
    const password = 'Theme-fixture-only-123!';
    siteId = (
      await db.query(
        `INSERT INTO sites(name,"widgetKey","allowedDomains","aiEnabled") VALUES('فروشگاه شب',$1,ARRAY['http://localhost:3000'],false) RETURNING id`,
        [key],
      )
    ).rows[0].id;
    await db.query(
      `INSERT INTO agents("siteId",email,"passwordHash","fullName",role) VALUES($1,$2,$3,'مدیر آزمایشی','admin')`,
      [siteId, email, await hash(password, 4)],
    );
    const visitor = (
      await db.query(
        `INSERT INTO visitors("siteId","visitorRef",name) VALUES($1,$2,'مشتری آزمایشی') RETURNING id`,
        [siteId, key],
      )
    ).rows[0].id;
    const conversation = (
      await db.query(`INSERT INTO conversations("siteId","visitorId") VALUES($1,$2) RETURNING id`, [
        siteId,
        visitor,
      ])
    ).rows[0].id;
    await db.query(
      `INSERT INTO messages("siteId","conversationId","senderType",content) VALUES($1,$2,'visitor','سلام، راهنمای خرید می‌خواهم')`,
      [siteId, conversation],
    );
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(password);
    await page.getByRole('button', { name: 'ورود به داشبورد', exact: true }).click();
    await expect(page.locator('#store-switch')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator(`[data-conversation-id="${conversation}"]`).click();
    for (const width of [1280, 768, 375]) {
      await page.setViewportSize({ width, height: 900 });
      const close = page.getByRole('button', { name: 'بستن اطلاعات بازدیدکننده', exact: true });
      if (await close.isVisible()) await close.click();
      await expect(page.getByLabel('رنگ‌بندی داشبورد', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.getByRole('button', { name: /ارسال لینک/ }).click();
      await expect(page.getByLabel('نشانی لینک', { exact: true })).toBeVisible();
      const color = await page
        .getByLabel('نشانی لینک', { exact: true })
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(color).not.toBe('rgb(255, 255, 255)');
      await info.attach('dashboard-dark-' + width, {
        body: await page.screenshot({ path: `test-results/dashboard-dark-${width}.png` }),
        contentType: 'image/png',
      });
      await page.getByRole('button', { name: 'بستن ابزار گفتگو', exact: true }).click();
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: 'تنظیمات', exact: true }).click();
    await expect(page.getByLabel('رنگ‌بندی داشبورد', { exact: true })).toHaveValue('dark');
    await page.getByRole('button', { name: 'استودیو ویجت', exact: true }).click();
    const preview = page.frameLocator('iframe[title="پیش‌نمایش ویجت"]');
    await expect(preview.locator('.mira-panel')).toBeVisible();
    expect(await preview.locator('html').getAttribute('data-theme')).toBeNull();
    const previewColor = await preview
      .locator('.mira-panel')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(previewColor).toBe('rgb(255, 255, 255)');
    await page.getByLabel('رنگ‌بندی داشبورد', { exact: true }).selectOption('light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  } finally {
    if (siteId) await db.query('DELETE FROM sites WHERE id=$1', [siteId]);
    await db.end();
  }
});
