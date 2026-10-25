import { test, expect, type Page } from '@playwright/test';
import { Client } from 'pg';
import { hash } from 'bcryptjs';
import { authenticator } from 'otplib';

const dashboardUrl = process.env.E2E_DASHBOARD_URL || 'http://localhost:5173';
const apiUrl = process.env.E2E_API_URL || 'http://localhost:3000';
const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const password = 'Store-fixture-only-123!';

async function login(page: Page, email: string, secret?: string) {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/v1/auth/login') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'ورود به داشبورد', exact: true }).click();
  const auth = await (await response).json();
  if (secret) {
    await expect(page.getByRole('heading', { name: 'تأیید دومرحله‌ای' })).toBeVisible();
    await page.locator('input[inputmode="numeric"]').fill(authenticator.generate(secret));
    await page.getByRole('button', { name: 'تأیید و ورود', exact: true }).click();
  }
  await expect(page.locator('#store-switch')).toBeVisible();
  return auth.accessToken as string;
}

test('switches isolated stores and labels background messages without losing the other login', async ({
  page,
  browser,
  request,
}) => {
  test.skip(!databaseUrl, 'Requires a disposable database for two tenant fixtures');
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  const siteIds: string[] = [];
  const secret = authenticator.generateSecret();
  const suffix = crypto.randomUUID();
  const emails = [`first-${suffix}@store.test`, `second-${suffix}@store.test`];
  const keys = [`first-${suffix}`, `second-${suffix}`];
  const names = ['فروشگاه آزمایشی اول', 'فروشگاه آزمایشی دوم'];
  const passwordHash = await hash(password, 4);
  const visitors: Page[] = [];
  try {
    for (let index = 0; index < 2; index++) {
      const site = await db.query(
        `INSERT INTO sites (name,"widgetKey","allowedDomains","aiEnabled") VALUES ($1,$2,ARRAY[$3],false) RETURNING id`,
        [names[index], keys[index], new URL(apiUrl).origin],
      );
      siteIds.push(site.rows[0].id);
      await db.query(
        `INSERT INTO agents ("siteId",email,"passwordHash","fullName",role,"twoFactorEnabled","twoFactorSecret") VALUES ($1,$2,$3,$4,'admin',$5,$6)`,
        [
          siteIds[index],
          emails[index],
          passwordHash,
          names[index],
          index === 1,
          index === 1 ? secret : null,
        ],
      );
    }
    await page.goto(dashboardUrl);
    const accessToken = await login(page, emails[0]);
    await expect(page.locator('#store-switch')).toHaveValue(siteIds[0]);
    await page.getByRole('button', { name: 'افزودن فروشگاه', exact: true }).click();
    await page.locator('input[type="email"]').fill(emails[1]);
    await page.locator('input[type="password"]').fill('wrong-password');
    await page.getByRole('button', { name: 'ورود به داشبورد', exact: true }).click();
    await expect(page.getByText('ورود ناموفق بود', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'بازگشت به فروشگاه‌ها', exact: true }).click();
    await expect(page.locator('#store-switch')).toHaveValue(siteIds[0]);
    await page.getByRole('button', { name: 'افزودن فروشگاه', exact: true }).click();
    await login(page, emails[1], secret);
    await expect(page.locator('#store-switch option')).toHaveCount(2);
    await page.locator('#store-switch').selectOption(siteIds[0]);
    await expect(page.getByRole('main').getByText(names[0], { exact: true })).toBeVisible();

    const visitor = await browser.newPage();
    visitors.push(visitor);
    await visitor.goto(`${apiUrl}/chat.html?key=${keys[1]}`);
    await expect(visitor.locator('.mira-panel.mira-open')).toBeVisible();
    const content = `پیام مخصوص فروشگاه دوم ${suffix}`;
    const started = visitor.waitForResponse(
      (r) => r.url().endsWith('/v1/widget/conversations') && r.request().method() === 'POST',
    );
    await visitor.locator('.mira-input').fill(content);
    await visitor.locator('.mira-send').click();
    const conversationId = (await (await started).json()).conversationId;
    await expect(visitor.locator('.mira-msg-visitor', { hasText: content })).toBeVisible();
    await expect(page.getByRole('status')).toContainText(`پیام جدید — ${names[1]}`);
    await expect(page.getByRole('status')).toContainText(content);
    await expect(page.locator(`#store-switch option[value="${siteIds[1]}"]`)).toContainText(
      '1 خوانده‌نشده',
    );
    await expect(page.locator(`[data-conversation-id="${conversationId}"]`)).toHaveCount(0);
    await page
      .getByRole('status')
      .getByRole('button', { name: /پیام جدید/ })
      .click();
    await expect(page.locator('#store-switch')).toHaveValue(siteIds[1]);
    await page.locator(`[data-conversation-id="${conversationId}"]`).click();
    await expect(page.getByText(content, { exact: true })).toBeVisible();
    await expect(page.locator(`#store-switch option[value="${siteIds[1]}"]`)).toContainText(
      '0 خوانده‌نشده',
    );

    // پاسخ واقعی سرور را نگه می‌داریم تا بعد از تعویض فروشگاه برسد.
    await db.query(`UPDATE conversations SET department='delayed' WHERE id=$1 AND "siteId"=$2`, [
      conversationId,
      siteIds[1],
    ]);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held: () => void = () => {};
    const responseHeld = new Promise<void>((resolve) => {
      held = resolve;
    });
    await page.route('**/v1/conversations?search=*', async (route) => {
      const response = await route.fetch();
      expect(
        (await response.json()).some(
          (conversation: { id: string }) => conversation.id === conversationId,
        ),
      ).toBe(true);
      held();
      await gate;
      await route.fulfill({ response });
    });
    await page.getByPlaceholder('جست‌وجوی نام، ایمیل یا دپارتمان...').fill('delayed');
    await responseHeld;
    await page.locator('#store-switch').selectOption(siteIds[0]);
    release();
    await expect(page.getByPlaceholder('جست‌وجوی نام، ایمیل یا دپارتمان...')).toHaveValue('');
    await expect(page.locator(`[data-conversation-id="${conversationId}"]`)).toHaveCount(0);
    await expect(page.getByText(content, { exact: true })).toHaveCount(0);
    await page.unroute('**/v1/conversations?search=*');

    // مسیر HTTP هم توکن هر فروشگاه را مستقل اعتبارسنجی می‌کند.
    const denied = await request.get(`/v1/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect([403, 404]).toContain(denied.status());
    await page.locator('#store-switch').selectOption(siteIds[1]);
    await page.getByTitle('خروج از این فروشگاه', { exact: true }).click();
    await expect(page.locator('#store-switch')).toHaveValue(siteIds[0]);
    await expect(page.locator('#store-switch option')).toHaveCount(1);
    await page.getByRole('button', { name: 'خروج از همهٔ فروشگاه‌ها', exact: true }).click();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    expect(
      await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
    ).toEqual({ local: {}, session: {} });
    await page.reload();
    await expect(page.locator('#store-switch')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  } finally {
    for (const visitor of visitors) await visitor.close();
    if (siteIds.length) await db.query('DELETE FROM sites WHERE id=ANY($1::uuid[])', [siteIds]);
    await db.end();
  }
});
