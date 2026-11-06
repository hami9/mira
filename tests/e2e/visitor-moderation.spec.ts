import { expect, test } from '@playwright/test';
import { Client } from 'pg';
import { hash } from 'bcryptjs';
import { io, type Socket } from 'socket.io-client';
import { SocketEvent, type MessageAck } from '@mira/shared-types';

const apiUrl = process.env.E2E_API_URL || 'http://localhost:3000';
const dashboardUrl = process.env.E2E_DASHBOARD_URL || 'http://localhost:5173';

test('visitor moderation is durable, isolated, reversible and reflected in the widget and inbox', async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  test.skip(!databaseUrl, 'Requires disposable tenant fixtures');
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  const key = crypto.randomUUID();
  const email = `${key}@moderation.test`;
  const password = 'Moderation-fixture-only-123!';
  const sites: string[] = [];
  const sockets: Socket[] = [];
  const visitorPage = await browser.newPage();
  try {
    for (const suffix of ['', '-other'])
      sites.push(
        (
          await db.query(
            `INSERT INTO sites (name,"widgetKey","allowedDomains","aiEnabled") VALUES ($1,$2,ARRAY[$3],false) RETURNING id`,
            ['فروشگاه کنترل مشتری', key + suffix, new URL(apiUrl).origin],
          )
        ).rows[0].id,
      );
    for (const [index, siteId] of sites.entries())
      await db.query(
        `INSERT INTO agents ("siteId",email,"passwordHash","fullName",role) VALUES ($1,$2,$3,'تست کنترل','admin')`,
        [siteId, index ? `other-${email}` : email, await hash(password, 4)],
      );
    const login = async (address: string) => {
      const response = await request.post(`${apiUrl}/v1/auth/login`, {
        data: { email: address, password },
      });
      expect(response.status()).toBe(200);
      return { Authorization: `Bearer ${(await response.json()).accessToken}` };
    };
    const headers = await login(email);
    const otherHeaders = await login(`other-${email}`);
    await page.goto(dashboardUrl);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'ورود به داشبورد', exact: true }).click();
    await expect(page.locator('#store-switch')).toBeVisible();
    await visitorPage.goto(`${apiUrl}/chat.html?key=${key}`);
    await expect(visitorPage.locator('.mira-panel.mira-open')).toBeVisible();
    await visitorPage.locator('.mira-input').fill('سلام، سفارش من');
    await visitorPage.locator('.mira-send').click();
    await expect(visitorPage.locator('.mira-msg-visitor')).toHaveCount(1);
    const conversation = (
      await db.query('SELECT * FROM conversations WHERE "siteId"=$1', [sites[0]])
    ).rows[0];
    const visitorId = conversation.visitorId as string;
    await page.locator(`[data-conversation-id="${conversation.id}"]`).click();
    const infoToggle = page.getByRole('button', { name: 'اطلاعات و مسیر بازدید', exact: true });
    if ((await infoToggle.getAttribute('aria-expanded')) === 'false') await infoToggle.click();
    await page.getByLabel('نام نمایشی بازدیدکننده', { exact: true }).fill('مشتری همکار');
    await page.getByLabel('عنوان پرچم', { exact: true }).fill('پیگیری ویژه');
    await page.getByLabel('رنگ پرچم', { exact: true }).selectOption('amber');
    await page.getByRole('button', { name: 'افزودن پرچم', exact: true }).click();
    await page.getByRole('button', { name: 'ذخیره مشخصات بازدیدکننده', exact: true }).click();
    await expect(page.locator(`button[data-conversation-id="${conversation.id}"]`)).toContainText(
      'مشتری همکار',
    );
    await expect(page.locator(`button[data-conversation-id="${conversation.id}"]`)).toContainText(
      'پیگیری ویژه',
    );
    await page.getByLabel('اولویت گفتگو', { exact: true }).selectOption('high');
    await expect(page.locator(`button[data-conversation-id="${conversation.id}"]`)).toContainText(
      'فوری',
    );
    await expect(page.locator(`button[data-conversation-id="${conversation.id}"]`)).toContainText(
      'مشتری همکار',
    );
    await expect(page.locator(`button[data-conversation-id="${conversation.id}"]`)).toContainText(
      'پیگیری ویژه',
    );
    const moderate = async (action: string, durationMinutes?: number) => {
      const response = await request.post(`${apiUrl}/v1/visitors/${visitorId}/moderation`, {
        headers,
        data: { action, ...(durationMinutes ? { durationMinutes } : {}) },
      });
      expect(response.ok()).toBe(true);
      return response.json();
    };
    expect(
      (
        await request.post(`${apiUrl}/v1/visitors/${visitorId}/moderation`, {
          headers: otherHeaders,
          data: { action: 'block' },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.post(`${apiUrl}/v1/visitors/${visitorId}/moderation`, {
          headers,
          data: { action: 'mute' },
        })
      ).status(),
    ).toBe(400);
    await moderate('mute', 15);
    await expect(visitorPage.locator('.mira-moderation')).toContainText('سکوت');
    await visitorPage.locator('.mira-input').fill('پیش‌نویس محفوظ');
    await expect(visitorPage.locator('.mira-send')).toBeDisabled();
    await visitorPage.reload();
    await expect(visitorPage.locator('.mira-moderation')).toContainText('سکوت');
    await expect(visitorPage.locator('.mira-msg-visitor')).toHaveCount(1);
    await moderate('unmute');
    await visitorPage.locator('.mira-input').fill('پیش‌نویس محفوظ');
    await expect(visitorPage.locator('.mira-send')).toBeEnabled();
    await moderate('block');
    await expect(visitorPage.locator('.mira-send')).toBeDisabled();
    await expect(visitorPage.locator('.mira-input')).toHaveValue('پیش‌نویس محفوظ');
    await testInfo.attach('moderation-inbox', {
      body: await page.screenshot({ path: 'test-results/moderation-inbox.png' }),
      contentType: 'image/png',
    });
    await moderate('unblock');
    await expect(visitorPage.locator('.mira-send')).toBeEnabled();
    expect(
      (await request.post(`${apiUrl}/v1/conversations/${conversation.id}/trash`, { headers })).ok(),
    ).toBe(true);
    await expect(visitorPage.locator('.mira-msg-visitor')).toHaveCount(0);
    await expect(visitorPage.locator('.mira-input')).toHaveValue('پیش‌نویس محفوظ');
    expect(
      (await request.get(`${apiUrl}/v1/conversations/${conversation.id}`, { headers })).status(),
    ).toBe(404);
    const active = await (await request.get(`${apiUrl}/v1/conversations`, { headers })).json();
    expect(active.some((row: { id: string }) => row.id === conversation.id)).toBe(false);
    const trash = await (
      await request.get(`${apiUrl}/v1/conversations?deleted=only`, { headers })
    ).json();
    expect(trash.some((row: { id: string }) => row.id === conversation.id)).toBe(true);
    expect(
      (
        await request.post(`${apiUrl}/v1/conversations/${conversation.id}/restore`, { headers })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await db.query('SELECT "aiPaused","lifecycleVersion" FROM conversations WHERE id=$1', [
          conversation.id,
        ])
      ).rows[0],
    ).toMatchObject({ aiPaused: true, lifecycleVersion: 2 });

    // سوکت واقعی: تکرار درخواستِ تأییدشده نباید سهمیه اسپم را مصرف کند.
    const sessionResponse = await request.post(`${apiUrl}/v1/widget/sessions`, {
      headers: { Origin: new URL(apiUrl).origin },
      data: { widgetKey: key, name: 'نام وردپرس' },
    });
    const session = await sessionResponse.json();
    const visitorHeaders = { Authorization: `Bearer ${session.visitorToken}` };
    const started = await (
      await request.post(`${apiUrl}/v1/widget/conversations`, { headers: visitorHeaders, data: {} })
    ).json();
    const socket = io(apiUrl, {
      auth: { token: session.visitorToken },
      transports: ['websocket'],
      extraHeaders: { Origin: new URL(apiUrl).origin },
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once(SocketEvent.VisitorModerationChanged, () => resolve());
      socket.once('connect_error', reject);
    });
    const send = (content: string, clientMessageId = crypto.randomUUID()) =>
      socket.timeout(10_000).emitWithAck(SocketEvent.MessageSend, {
        conversationId: started.conversationId,
        content,
        clientMessageId,
      }) as Promise<MessageAck>;
    const retryId = crypto.randomUUID();
    const first = await send('پیام تکراری اسپم', retryId);
    expect(first).toHaveProperty('id');
    for (let index = 0; index < 7; index++)
      expect(await send('پیام تکراری اسپم', retryId)).toEqual(first);
    for (let index = 0; index < 4; index++)
      expect(await send('پیام تکراری اسپم')).toHaveProperty('id');
    expect(await send('پیام تکراری اسپم')).toMatchObject({ error: { code: 'VISITOR_BLOCKED' } });
    const spamVisitor = (
      await db.query(
        'SELECT v.* FROM visitors v JOIN conversations c ON c."visitorId"=v.id WHERE c.id=$1',
        [started.conversationId],
      )
    ).rows[0];
    expect(spamVisitor.blockSource).toBe('spam');
    expect(spamVisitor.blockedUntil.getTime()).toBeGreaterThan(Date.now());
    expect(
      (
        await request.post(`${apiUrl}/v1/widget/conversations`, {
          headers: visitorHeaders,
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.get(`${apiUrl}/v1/widget/conversations/${started.conversationId}/messages`, {
          headers: visitorHeaders,
        })
      ).ok(),
    ).toBe(true);
    // نام داخلی با ورود دوباره و تغییر نام سایت بازنویسی نمی‌شود.
    expect(
      (
        await request.patch(`${apiUrl}/v1/visitors/${spamVisitor.id}/details`, {
          headers,
          data: { displayName: 'نام داخلی' },
        })
      ).ok(),
    ).toBe(true);
    await request.post(`${apiUrl}/v1/widget/sessions`, {
      headers: { Origin: new URL(apiUrl).origin },
      data: { widgetKey: key, visitorRef: session.visitorRef, name: 'نام جدید سایت' },
    });
    expect(
      (await db.query('SELECT name,"displayName" FROM visitors WHERE id=$1', [spamVisitor.id]))
        .rows[0],
    ).toEqual({ name: 'نام جدید سایت', displayName: 'نام داخلی' });
    const restricted = await send('پیام پس از بلاک');
    expect(restricted).toMatchObject({ error: { code: 'VISITOR_BLOCKED' } });
    await request.post(`${apiUrl}/v1/visitors/${spamVisitor.id}/moderation`, {
      headers,
      data: { action: 'unblock' },
    });
    await request.post(`${apiUrl}/v1/visitors/${spamVisitor.id}/moderation`, {
      headers,
      data: { action: 'mute', durationMinutes: 15 },
    });
    expect(await send('پیام در سکوت')).toMatchObject({ error: { code: 'VISITOR_MUTED' } });
    await request.post(`${apiUrl}/v1/visitors/${spamVisitor.id}/moderation`, {
      headers,
      data: { action: 'unmute' },
    });
    const foreignSession = await (
      await request.post(`${apiUrl}/v1/widget/sessions`, {
        headers: { Origin: new URL(apiUrl).origin },
        data: { widgetKey: `${key}-other`, visitorRef: session.visitorRef },
      })
    ).json();
    expect(foreignSession.moderation).toMatchObject({ blocked: false, mutedUntil: null });
    // پانزده پیام متفاوت و همزمان هم باید زیر قفل واقعی به یک بلاک پایدار برسند.
    const burstSession = await (
      await request.post(`${apiUrl}/v1/widget/sessions`, {
        headers: { Origin: new URL(apiUrl).origin },
        data: { widgetKey: key },
      })
    ).json();
    const burstConversation = await (
      await request.post(`${apiUrl}/v1/widget/conversations`, {
        headers: { Authorization: `Bearer ${burstSession.visitorToken}` },
        data: {},
      })
    ).json();
    const burstSocket = io(apiUrl, {
      auth: { token: burstSession.visitorToken },
      transports: ['websocket'],
      extraHeaders: { Origin: new URL(apiUrl).origin },
    });
    sockets.push(burstSocket);
    await new Promise<void>((resolve, reject) => {
      burstSocket.once(SocketEvent.VisitorModerationChanged, () => resolve());
      burstSocket.once('connect_error', reject);
    });
    const burst = await Promise.all(
      Array.from(
        { length: 15 },
        (_, index) =>
          burstSocket.timeout(10_000).emitWithAck(SocketEvent.MessageSend, {
            conversationId: burstConversation.conversationId,
            content: `پیام متفاوت ${index}`,
            clientMessageId: crypto.randomUUID(),
          }) as Promise<MessageAck>,
      ),
    );
    expect(burst.filter((ack) => 'id' in ack)).toHaveLength(14);
    expect(burst.filter((ack) => 'error' in ack)).toEqual([
      expect.objectContaining({ error: expect.objectContaining({ code: 'VISITOR_BLOCKED' }) }),
    ]);
    // حساب اپراتور بدون مجوزهای جدید اجازه محدودیت و حذف ندارد.
    const operatorEmail = `operator-${email}`;
    await db.query(
      `INSERT INTO agents ("siteId",email,"passwordHash","fullName",role,permissions) VALUES ($1,$2,$3,'اپراتور محدود','agent','{}')`,
      [sites[0], operatorEmail, await hash(password, 4)],
    );
    const operatorHeaders = await login(operatorEmail);
    expect(
      (
        await request.post(`${apiUrl}/v1/visitors/${visitorId}/moderation`, {
          headers: operatorHeaders,
          data: { action: 'block' },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post(`${apiUrl}/v1/conversations/${conversation.id}/trash`, {
          headers: operatorHeaders,
        })
      ).status(),
    ).toBe(403);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    await visitorPage.close();
    for (const id of sites) await db.query('DELETE FROM sites WHERE id=$1', [id]);
    await db.end();
  }
});
