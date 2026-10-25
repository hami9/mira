import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { hash } from 'bcryptjs';
import sharp from 'sharp';

test('crops and persists a circular avatar with bounded uploads and tenant ownership', async ({
  page,
  request,
}, testInfo) => {
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  test.skip(!databaseUrl, 'Requires disposable tenant fixtures');
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  const api = process.env.E2E_API_URL || 'http://localhost:3000';
  const email = `${crypto.randomUUID()}@avatar.test`;
  const password = 'Avatar-fixture-only-123!';
  let siteId: string | undefined;
  try {
    siteId = (
      await db.query(
        `INSERT INTO sites (name,"widgetKey","allowedDomains") VALUES ('فروشگاه تصویر',$1,'{}') RETURNING id`,
        [crypto.randomUUID()],
      )
    ).rows[0].id;
    const agentId = (
      await db.query(
        `INSERT INTO agents ("siteId",email,"passwordHash","fullName",role) VALUES ($1,$2,$3,'مدیر تصویر','admin') RETURNING id`,
        [siteId, email, await hash(password, 4)],
      )
    ).rows[0].id;
    await page.goto(process.env.E2E_DASHBOARD_URL || 'http://localhost:5173');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    const authentication = page.waitForResponse(
      (r) => r.url().endsWith('/v1/auth/login') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'ورود به داشبورد', exact: true }).click();
    const { accessToken } = await (await authentication).json();
    await page.getByRole('button', { name: 'تنظیمات', exact: true }).click();
    const ai = page.getByRole('region', { name: 'مرکز هوش مصنوعی', exact: true });
    const picker = ai.getByLabel('تصویر دستیار', { exact: true });
    await picker.setInputFiles({
      name: 'too-large.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    });
    await expect(ai.getByRole('alert')).toContainText('۱۰ مگابایت');
    const image = await sharp({
      create: { width: 640, height: 320, channels: 3, background: '#17b8a6' },
    })
      .png()
      .toBuffer();
    await picker.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: image });
    const crop = ai.getByRole('group', { name: 'برش دایره‌ای تصویر', exact: true });
    await expect(crop).toBeVisible();
    await crop.getByLabel('بزرگ‌نمایی عکس').fill('1.3');
    await crop.getByLabel('جابه‌جایی افقی عکس').fill('70');
    await testInfo.attach('avatar-crop', {
      body: await page.screenshot({ path: 'test-results/avatar-crop.png' }),
      contentType: 'image/png',
    });
    await crop.getByRole('button', { name: 'تأیید برش و ذخیره عکس' }).click();
    await expect(crop).toBeHidden();
    const saved = (await db.query('SELECT "aiBotAvatarUrl" FROM sites WHERE id=$1', [siteId]))
      .rows[0].aiBotAvatarUrl;
    expect(saved).toContain(`/v1/avatars/${siteId}/${siteId}/`);
    const tabs = page.getByRole('navigation', { name: 'بخش‌های تنظیمات', exact: true });
    await tabs.getByRole('button', { name: 'پایگاه دانش', exact: true }).click();
    await tabs.getByRole('button', { name: 'هوش مصنوعی', exact: true }).click();
    await expect(ai.getByRole('img', { name: 'تصویر دستیار', exact: true })).toHaveAttribute(
      'src',
      saved,
    );
    const downloaded = await request.get(saved);
    expect(downloaded.status()).toBe(200);
    expect(downloaded.headers()['content-type']).toContain('image/png');
    const pixels = await sharp(await downloaded.body())
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(pixels.info).toMatchObject({ width: 256, height: 256, channels: 4 });
    expect(pixels.data[3]).toBe(0);
    expect(pixels.data[(128 * 256 + 128) * 4 + 3]).toBe(255);
    const foreign = saved.replace(siteId!, crypto.randomUUID());
    expect((await request.get(foreign)).status()).toBe(404);
    expect(
      (
        await request.post(`${api}/v1/avatars/assistant`, {
          multipart: { image: { name: 'x.png', mimeType: 'image/png', buffer: image } },
        })
      ).status(),
    ).toBe(401);
    const headers = { Authorization: `Bearer ${accessToken}` };
    expect(
      (
        await request.post(`${api}/v1/avatars/assistant`, {
          headers,
          multipart: {
            image: {
              name: 'x.png',
              mimeType: 'image/png',
              buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
            },
          },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post(`${api}/v1/avatars/me`, {
          headers,
          multipart: {
            image: {
              name: 'huge.png',
              mimeType: 'image/png',
              buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
            },
          },
        })
      ).status(),
    ).toBe(413);
    const own = await request.post(`${api}/v1/avatars/me`, {
      headers,
      multipart: { image: { name: 'me.png', mimeType: 'image/png', buffer: image } },
    });
    expect(own.status()).toBe(201);
    expect((await own.json()).url).toContain(`/v1/avatars/${siteId}/${agentId}/`);
    await db.query(`UPDATE agents SET role='agent',permissions='{}' WHERE id=$1 AND "siteId"=$2`, [
      agentId,
      siteId,
    ]);
    expect(
      (
        await request.post(`${api}/v1/avatars/assistant`, {
          headers,
          multipart: { image: { name: 'x.png', mimeType: 'image/png', buffer: image } },
        })
      ).status(),
    ).toBe(403);
    await request.post(`${api}/v1/avatars/me`, {
      headers,
      multipart: { image: { name: 'me.png', mimeType: 'image/png', buffer: image } },
    });
    expect(
      Number(
        (await db.query('SELECT count(*) FROM avatars WHERE "siteId"=$1', [siteId])).rows[0].count,
      ),
    ).toBe(2);
  } finally {
    if (siteId) await db.query('DELETE FROM sites WHERE id=$1', [siteId]);
    await db.end();
  }
});
