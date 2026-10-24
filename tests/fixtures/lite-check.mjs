import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { io } from 'socket.io-client';
import shared from '../../packages/shared-types/dist/index.js';

// این ابزار فقط برای نصب موقت محلی است؛ روی سرور یا داده واقعی اجرا نمی‌شود.
assert.equal(
  process.env.MIRA_LITE_FIXTURE,
  '1',
  'Set MIRA_LITE_FIXTURE=1 for the disposable local stack',
);
const origin = 'http://localhost:43300';
const phase = process.argv[2];
assert.ok(['create', 'verify'].includes(phase));
const statePath = new URL('../../package/dist/lite-state.json', import.meta.url);
async function post(path, body, token) {
  const response = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  assert.ok(response.ok, `${path}: ${response.status}`);
  return response.json();
}
assert.equal((await fetch(`${origin}/health`)).status, 200);
assert.equal((await fetch(`${origin}/`)).status, 200);
assert.equal((await fetch(`${origin}/.env`)).status, 404);
assert.equal((await fetch(`${origin}/demo.html`)).status, 404);
const config = await (await fetch(`${origin}/config.js`)).text();
assert.ok(config.includes('window.location.origin'));
if (phase === 'create') {
  const session = await post('/v1/widget/sessions', { widgetKey: 'kgkala-demo-key' });
  const conversation = await post('/v1/widget/conversations', {}, session.visitorToken);
  const socket = io(origin, {
    auth: { token: session.visitorToken },
    transports: ['websocket'],
    extraHeaders: { Origin: origin },
    reconnection: false,
    timeout: 10_000,
  });
  try {
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    socket.emit(shared.SocketEvent.ConversationJoin, {
      conversationId: conversation.conversationId,
    });
    const content = `lite-preservation-${crypto.randomUUID()}`;
    const ack = await socket.timeout(10_000).emitWithAck(shared.SocketEvent.MessageSend, {
      conversationId: conversation.conversationId,
      content,
      clientMessageId: crypto.randomUUID(),
    });
    assert.ok(ack?.id);
    // فقط شناسه عمومی و پیام ساختگی نگه‌داری می‌شود؛ هیچ توکنی روی دیسک نمی‌رود.
    await writeFile(
      statePath,
      JSON.stringify({
        visitorRef: session.visitorRef,
        conversationId: conversation.conversationId,
        content,
      }),
    );
  } finally {
    socket.disconnect();
  }
  console.log('Lite HTTP and live message checks passed.');
} else {
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  const session = await post('/v1/widget/sessions', {
    widgetKey: 'kgkala-demo-key',
    visitorRef: state.visitorRef,
  });
  assert.equal(session.activeConversationId, state.conversationId);
  const response = await fetch(
    `${origin}/v1/widget/conversations/${state.conversationId}/messages`,
    { headers: { Origin: origin, Authorization: `Bearer ${session.visitorToken}` } },
  );
  assert.ok(response.ok);
  const messages = await response.json();
  assert.equal(messages.filter((message) => message.content === state.content).length, 1);
  console.log('Lite restart preserved the visitor, conversation and message.');
}
