import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { hash } from 'bcryptjs';
import { readFile } from 'node:fs/promises';

test('imports Markdown, edits keywords, controls source activation and saves the guardrail switch', async ({
  page,
}, testInfo) => {
  test.skip(process.env.AI_E2E !== '1', 'Requires the fixture provider and live worker');
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  test.skip(!databaseUrl, 'Requires disposable tenant fixtures');
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  const key = crypto.randomUUID();
  const email = `${key}@knowledge.test`;
  const password = 'Knowledge-fixture-only-123!';
  let siteId: string | undefined;
  const content =
    '# راهنمای گارانتی\n\nبرای بررسی گارانتی شماره سفارش را به پشتیبان بدهید.\n\n<script>window.__kb_xss=1</script>';
  try {
    siteId = (
      await db.query(
        `INSERT INTO sites (name,"widgetKey","allowedDomains","aiEnabled") VALUES ('فروشگاه دانش',$1,'{}',false) RETURNING id`,
        [key],
      )
    ).rows[0].id;
    await db.query(
      `INSERT INTO agents ("siteId",email,"passwordHash","fullName",role) VALUES ($1,$2,$3,'مدیر دانش','admin')`,
      [siteId, email, await hash(password, 4)],
    );
    await page.goto(process.env.E2E_DASHBOARD_URL || 'http://localhost:5173');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'ورود به داشبورد', exact: true }).click();
    await page.getByRole('button', { name: 'تنظیمات', exact: true }).click();
    const tabs = page.getByRole('navigation', { name: 'بخش‌های تنظیمات', exact: true });
    await tabs.getByRole('button', { name: 'پایگاه دانش', exact: true }).click();
    const knowledge = page.getByRole('region', { name: 'پایگاه دانش', exact: true });
    await knowledge.getByRole('button', { name: 'افزودن منبع', exact: true }).click();
    const editor = page.getByRole('form', { name: 'ویرایش منبع دانش', exact: true });
    await editor
      .getByLabel('فایل Markdown', { exact: true })
      .setInputFiles({ name: 'wrong.txt', mimeType: 'text/plain', buffer: Buffer.from(content) });
    await expect(knowledge.getByRole('alert')).toContainText('فقط فایل Markdown');
    await editor.getByLabel('فایل Markdown', { exact: true }).setInputFiles({
      name: 'warranty.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(content),
    });
    await expect(editor.getByLabel('عنوان منبع', { exact: true })).toHaveValue('راهنمای گارانتی');
    await expect(editor.getByLabel('متن منبع', { exact: true })).toHaveValue(content);
    await editor.getByLabel('کلمات کلیدی', { exact: false }).fill('گارانتی، ضمانت، گارانتی');
    await editor
      .getByRole('checkbox', { name: 'فعال برای پاسخ‌گویی پس از آماده‌شدن', exact: true })
      .uncheck();
    await editor.getByRole('button', { name: 'ذخیره منبع', exact: true }).click();
    await expect(editor).toBeHidden();
    const row = knowledge.locator('[data-document-id]');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('غیرفعال');
    const documentId = await row.getAttribute('data-document-id');
    const saved = (
      await db.query(
        `SELECT enabled,keywords,"sourceType" FROM knowledge_base_documents WHERE id=$1 AND "siteId"=$2`,
        [documentId, siteId],
      )
    ).rows[0];
    expect(saved).toMatchObject({
      enabled: false,
      keywords: ['گارانتی', 'ضمانت'],
      sourceType: 'markdown',
    });
    await row.getByRole('switch', { name: 'فعال‌بودن راهنمای گارانتی', exact: true }).check();
    await expect(row).toContainText('آمادهٔ پاسخ‌گویی', { timeout: 30_000 });
    await row.getByRole('button', { name: 'ویرایش', exact: true }).click();
    await expect(editor.getByLabel('متن منبع', { exact: true })).toHaveValue(content);
    await editor.getByLabel('کلمات کلیدی', { exact: false }).fill('گارانتی، ضمانت، خدمات');
    await editor.getByRole('button', { name: 'ذخیره منبع', exact: true }).click();
    await expect(editor).toBeHidden();
    await expect(row).toContainText('آمادهٔ پاسخ‌گویی', { timeout: 30_000 });
    const downloading = page.waitForEvent('download');
    await row.getByRole('button', { name: 'دریافت فایل', exact: true }).click();
    const download = await downloading;
    expect(await readFile((await download.path())!, 'utf8')).toBe(content);
    expect(
      await page.evaluate(() => (window as Window & { __kb_xss?: number }).__kb_xss),
    ).toBeUndefined();
    await testInfo.attach('knowledge', {
      body: await page.screenshot({ path: 'test-results/knowledge.png' }),
      contentType: 'image/png',
    });
    await tabs.getByRole('button', { name: 'هوش مصنوعی', exact: true }).click();
    const ai = page.getByRole('region', { name: 'مرکز هوش مصنوعی', exact: true });
    await ai.getByRole('button', { name: 'گاردریل‌ها', exact: true }).click();
    const toggle = ai.getByRole('switch', { name: 'فعال‌بودن گاردریل‌ها', exact: true });
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await expect(ai.getByLabel('موضوع‌های ممنوع', { exact: false })).toBeDisabled();
    await ai.getByRole('button', { name: 'ذخیره تنظیمات AI', exact: true }).click();
    await expect(ai.getByRole('status')).toContainText('ذخیره شد');
    expect(
      (await db.query(`SELECT "aiPolicy" FROM sites WHERE id=$1`, [siteId])).rows[0].aiPolicy
        .guardrailsEnabled,
    ).toBe(false);
    await tabs.getByRole('button', { name: 'پایگاه دانش', exact: true }).click();
    await tabs.getByRole('button', { name: 'هوش مصنوعی', exact: true }).click();
    await ai.getByRole('button', { name: 'گاردریل‌ها', exact: true }).click();
    await expect(toggle).not.toBeChecked();
    await testInfo.attach('guardrails', {
      body: await page.screenshot({ path: 'test-results/guardrails.png' }),
      contentType: 'image/png',
    });
    await tabs.getByRole('button', { name: 'سیستم', exact: true }).click();
    await page.getByRole('button', { name: 'بررسی منابع', exact: true }).click();
    await expect(
      page.getByText('نمایش منابع کل نصب فقط برای مدیر میزبان فعال است.', { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await tabs.getByRole('button', { name: 'پایگاه دانش', exact: true }).click();
    await expect(row).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await testInfo.attach('knowledge-mobile', {
      body: await page.screenshot({ path: 'test-results/knowledge-mobile.png' }),
      contentType: 'image/png',
    });
  } finally {
    if (siteId) await db.query('DELETE FROM sites WHERE id=$1', [siteId]);
    await db.end();
  }
});
