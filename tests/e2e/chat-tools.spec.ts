import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { hash } from 'bcryptjs';
const api = process.env.E2E_API_URL || 'http://localhost:3000';
const dashboard = process.env.E2E_DASHBOARD_URL || 'http://localhost:5173';
test('operators send reusable forms and page cards with durable private submissions', async ({
  page,
  browser,
  request,
}, info) => {
  test.setTimeout(180000);
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  test.skip(!databaseUrl, 'Requires disposable fixtures');
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  const sites: string[] = [];
  const key = crypto.randomUUID();
  const email = key + '@tools.test';
  const password = 'Tools-fixture-only-123!';
  const visitor = await browser.newPage();
  try {
    for (const suffix of ['', '-other'])
      sites.push(
        (
          await db.query(
            `INSERT INTO sites(name,"widgetKey","allowedDomains","aiEnabled") VALUES('ابزارهای گفتگو',$1,ARRAY[$2],false) RETURNING id`,
            [key + suffix, new URL(api).origin],
          )
        ).rows[0].id,
      );
    for (const [index, id] of sites.entries())
      await db.query(
        `INSERT INTO agents("siteId",email,"passwordHash","fullName",role) VALUES($1,$2,$3,'اپراتور آزمایشی','agent')`,
        [id, index ? 'other-' + email : email, await hash(password, 4)],
      );
    const login = async (address: string) => {
      const r = await request.post(api + '/v1/auth/login', { data: { email: address, password } });
      expect(r.status()).toBe(200);
      return { Authorization: 'Bearer ' + (await r.json()).accessToken };
    };
    const headers = await login(email);
    const other = await login('other-' + email);
    await db.query(
      'INSERT INTO canned_responses ("siteId",shortcut,title,content) VALUES ($1,$2,$3,$4)',
      [sites[0], 'shipping', 'زمان ارسال', 'سفارش امروز ارسال می‌شود.'],
    );
    await page.goto(dashboard);
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(password);
    await page.getByRole('button', { name: 'ورود به داشبورد', exact: true }).click();
    await expect(page.locator('#store-switch')).toBeVisible();
    await visitor.goto(api + '/chat.html?key=' + key);
    await visitor.locator('.mira-input').fill('سلام');
    await visitor.locator('.mira-send').click();
    await expect(visitor.locator('.mira-msg-visitor')).toHaveCount(1);
    const conversation = (
      await db.query('SELECT * FROM conversations WHERE "siteId"=$1', [sites[0]])
    ).rows[0];
    await page.locator(`[data-conversation-id="${conversation.id}"]`).click();
    const composer = page.getByRole('textbox', { name: 'پاسخ به بازدیدکننده', exact: true });
    await composer.fill('سلام، پیگیری کردم.');
    await page.getByRole('button', { name: 'پاسخ آماده', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'پاسخ‌های آماده' })
      .getByRole('button', { name: /زمان ارسال/ })
      .click();
    await expect(composer).toHaveValue('سلام، پیگیری کردم.\nسفارش امروز ارسال می‌شود.');
    const search = page.getByRole('searchbox', { name: 'جست‌وجوی گفتگوها', exact: true });
    await search.fill('این نام در صندوق وجود ندارد');
    await expect(page.getByText('گفتگویی با این فیلترها پیدا نشد.')).toBeVisible();
    await expect(composer).toHaveValue('سلام، پیگیری کردم.\nسفارش امروز ارسال می‌شود.');
    await page.getByRole('button', { name: 'پاک کردن فیلترها', exact: true }).click();
    await page.getByRole('button', { name: /ارسال لینک/ }).click();
    await page
      .getByLabel('نشانی لینک', { exact: true })
      .fill('https://shop.example/product/cable?color=green');
    await page.getByLabel('عنوان کارت', { exact: true }).fill('کابل شارژ پیشنهادی');
    await page.getByRole('button', { name: 'ارسال کارت لینک', exact: true }).click();
    await expect(
      visitor.getByRole('link', { name: 'باز کردن صفحه ↗', exact: true }),
    ).toHaveAttribute('href', 'https://shop.example/product/cable?color=green');
    const sentLink = (
      await db.query(
        `SELECT * FROM messages WHERE "conversationId"=$1 AND "toolMetadata"->>'kind'='link'`,
        [conversation.id],
      )
    ).rows[0];
    expect(sentLink.toolMetadata.title).toBe('کابل شارژ پیشنهادی');
    expect(
      (
        await request.post(`${api}/v1/conversations/${conversation.id}/links`, {
          headers,
          data: { url: 'javascript:alert(1)', clientMessageId: crypto.randomUUID() },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post(`${api}/v1/conversations/${conversation.id}/links`, {
          headers: other,
          data: { url: 'https://shop.example', clientMessageId: crypto.randomUUID() },
        })
      ).ok(),
    ).toBe(false);
    await page.getByRole('button', { name: /ارسال فرم/ }).click();
    await page.getByRole('button', { name: 'ساخت فرم جدید', exact: true }).click();
    await page.getByLabel('عنوان فرم', { exact: true }).fill('مشاوره خرید');
    await page.getByLabel('عنوان فیلد 1', { exact: true }).fill('نیاز شما');
    await page.getByRole('button', { name: 'ذخیره فرم', exact: true }).click();
    await page.getByRole('button', { name: 'ارسال فرم به مشتری', exact: true }).click();
    await expect(visitor.getByLabel('نیاز شما', { exact: true })).toBeVisible();
    await visitor.getByLabel('نیاز شما', { exact: true }).fill('شماره تماس خصوصی من 09123456789');
    const formMessage = (
      await db.query(
        `SELECT * FROM messages WHERE "conversationId"=$1 AND "toolMetadata"->>'kind'='form-request'`,
        [conversation.id],
      )
    ).rows[0];
    await request.patch(api + '/v1/chat-forms/' + formMessage.toolMetadata.templateId, {
      headers,
      data: {
        title: 'فرم ویرایش‌شده',
        fields: [{ id: 'changed', label: 'فیلد جدید', type: 'email', required: true }],
      },
    });
    await visitor.getByRole('button', { name: 'ارسال پاسخ فرم', exact: true }).click();
    await expect(page.getByRole('region', { name: 'پنجرهٔ گفتگو' })).toContainText(
      'شماره تماس خصوصی من',
    );
    await visitor.reload();
    await expect(visitor.locator('.mira-form-success')).toContainText('پاسخ شما ثبت شده');
    await expect(visitor.getByLabel('نیاز شما', { exact: true })).toHaveCount(0);
    const response = (
      await db.query(
        `SELECT * FROM messages WHERE "conversationId"=$1 AND "toolMetadata"->>'kind'='form-response'`,
        [conversation.id],
      )
    ).rows;
    expect(response).toHaveLength(1);
    expect(response[0].content).not.toContain('09123456789');
    expect(Object.values(response[0].toolMetadata.answers)).toContain(
      'شماره تماس خصوصی من 09123456789',
    );
    for (const width of [1280, 768, 375]) {
      await page.setViewportSize({ width, height: 812 });
      const closeInfo = page.getByRole('button', { name: 'بستن اطلاعات بازدیدکننده', exact: true });
      if (await closeInfo.isVisible()) await closeInfo.click();
      await expect(page.getByRole('region', { name: 'پنجرهٔ گفتگو' })).toContainText('مشاوره خرید');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.getByRole('button', { name: /ارسال لینک/ }).click();
    await expect(page.getByLabel('نشانی لینک', { exact: true })).toBeVisible();
    await info.attach('chat-tools-mobile', {
      body: await page.screenshot({ path: 'test-results/chat-tools-mobile.png' }),
      contentType: 'image/png',
    });
  } finally {
    await visitor.close();
    for (const id of sites) await db.query('DELETE FROM sites WHERE id=$1', [id]);
    await db.end();
  }
});
