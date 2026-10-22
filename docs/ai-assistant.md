# AI assistant

**English** · [فارسی](ai-assistant.fa.md)

Mira answers from approved shop information and can present WooCommerce product cards.

## Setup

1. Apply migrations and deploy the API, worker, dashboard and widget together. Migration
   `1737300800000-AiAssistant` adds site policy, message metadata and a durable handoff flag.
2. Configure the provider and credentials in the server environment. The dashboard can
   override the chat model identifier, but cannot read provider keys. Embeddings still use
   the server's configured embedding model with 768 dimensions.
3. Open **Settings → AI center**. Set the assistant name, greeting, suggested questions,
   response style, handoff message, model, temperature and response limits.
4. Add documents to the existing knowledge base and wait for `ready`. Enable the sources
   you want: knowledge documents, public WordPress pages, WooCommerce products, or the
   approved server information text. This text is for customer-facing facts, not secrets.
5. For live website data, install the updated Mira WordPress plugin and save the WordPress
   HTTPS URL and shared API key in the connection settings. The key is write-only in API
   settings responses; a blank input preserves it. Live website sources default to off.
6. Test through the real widget. The settings preview illustrates appearance and does not
   call a model.

## Usage and billing

Admins can open **Settings → AvalAI costs and credit** to see Mira's token usage,
failed requests, distinct visitors, average tokens per visitor and final charges for
1, 7 or 30 days. The table shows the 100 visitors with the highest usage; totals cover all
visitors. Reply, retrieval, copilot and summary usage belongs to the conversation's visitor.
Document embedding appears only in site totals. These are visitor identities, not a count
of verified people across devices. Migration `1737300900000-AiUsage` starts a new ledger;
historical usage is not backfilled. Missing provider usage stays unknown; totals may be
partial and averages are withheld when successful visitor requests lack token counts.

Set `AI_PROVIDER=openai`, `AVALAI_API_KEY`, `AVALAI_BASE_URL=https://api.avalai.ir/v1`,
`AVALAI_MODEL=deepseek-v4-flash` and `AVALAI_SITE_ID=<site UUID>` in the server `.env`.
Leave `OPENAI_API_KEY` empty to select the AvalAI credentials, endpoint and model together.
Explicit `OPENAI_*` credentials take priority. Docker passes `.env` to the API and worker;
recreate both after changing it. For host-only test scripts, `.env.avalai.local` is ignored
by Git. The application does not automatically load that test file.

The site binding is mandatory for account data: other tenants cannot see balances or
account-wide costs. Every billing/report request checks the current admin role in the
database, including cached responses. Provider keys never enter browser responses.
Local token reports work without AvalAI. Account balance and the account-wide 24-hour
summary come from the [AvalAI User API](https://docs.avalai.ir/en/api-reference/user),
with a two-minute server cache. Account usage may include other applications.

Successful AvalAI calls store the `avalai-request-id` response header. Opening or refreshing
billing reconciles up to 100 pending transactions older than 30 seconds, using the read-only
transaction lookup API. The stored `cost.unit` is the final USD charge; it is not inferred
from balance changes. Missing charges remain pending. Other providers and requests without
this header retain token usage but have no final charge integration. Keep the dashboard
open or refresh it later to retrieve delayed charges. There is no scheduled reconciliation.

The calculator uses live per-million text token prices, including published long-context
rates, without cache discounts, credit packages or tool fees. It is an estimate. Quick
payment opens the official AvalAI billing page; the user completes payment there.

## Data and guardrails

- The worker calls the fixed `/wp-json/mira/v1/ai-context` route with `X-Mira-Api-Key`.
  Only public, passwordless posts/pages and visible, purchasable products are returned.
  Prices respect WooCommerce's display tax settings; variable products show a starting price.
  Cards link to the product page. Checkout, private orders and account actions are not AI tools.
- Website requests require public HTTPS on port 443. Private/reserved addresses, mixed
  public/private DNS results, credentials in URLs and redirects are rejected. DNS is pinned
  for the request, and response size/time are bounded. Internal server facts can be supplied
  through approved text or the knowledge base; the bot has no shell or arbitrary URL access.
- All bot queries are tenant-scoped. Sources and history are passed as untrusted data in a
  user message. JSON responses must refer to supplied source/product IDs. Card fields and
  links come from server data, never model-written HTML or URLs.
- Forbidden topics use normalized substring matching, not a semantic moderation model.
  Common email, phone and credential patterns are redacted from conversation/context text.
  These controls reduce risk; they do not detect every secret or guarantee factual answers.
  Model confidence is self-reported, not a calibrated probability. Retrieval similarity is
  an independent threshold for knowledge documents.
- Missing evidence, invalid output, provider failure, a reply limit or a human request
  pauses automatic replies for that conversation. Human agents can continue normally.
  Closing and reopening that same conversation preserves the handoff. A new conversation
  starts with AI enabled according to site settings.
- Conversation locks and a deterministic reply ID prevent duplicate bot messages. Before
  writing, the worker checks for a newer message, agent takeover, resolution or disabled AI.
- The widget displays real retrieval/generation stages with a 60-second expiry. It does not
  display private model reasoning. Disconnects, replies and terminal events clear the indicator.
  Reconnected history is deduplicated by message ID. Failed sends preserve the draft.

## Verification

```bash
npm ci
npm run build
npm run lint
npm run format:check
npm test
# Disposable Postgres with pgvector, migrated first:
npm run test:integration
```

`tests/integration/ai-assistant.test.ts` uses real Postgres and deterministic model/embedding
substitutes. Browser AI tests require the real API, Redis and worker, plus
`node tests/fixtures/ai-provider.mjs`, `OPENAI_BASE_URL=http://127.0.0.1:4201/v1`,
`OPENAI_API_KEY=fixture-only` and `AI_E2E=1`. CI starts these explicitly. This verifies
transport and persistence, not answer quality from a commercial provider.

The separate `tests/fixtures/wordpress.yml` stack supports a real plugin contract check:
install WordPress and WooCommerce, activate `mira`, then run
`docker compose -f tests/fixtures/wordpress.yml run --rm cli eval-file /tmp/wordpress-check.php`.
The fixture removes its posts and restores its key. Remove the disposable stack and its volume
with `docker compose -f tests/fixtures/wordpress.yml down -v` after testing.

The source contract follows [WordPress query visibility controls](https://developer.wordpress.org/reference/classes/wp_query/)
and [WooCommerce product data](https://woocommerce.github.io/code-reference/classes/WC-Product.html).

A bounded paid check is available after building: set `TEST_DATABASE_URL` to a disposable
migrated database, configure Redis and `.env.avalai.local`, then run
`node tests/fixtures/avalai-usage.mjs`. It sends one queued request, verifies token attribution,
reads live credit, reconciles the actual charge, and deletes its fixture rows. It uses a
unique queue prefix. `tests/fixtures/avalai-check.mjs` separately tests three model responses.
These scripts make paid calls only when explicitly run; CI uses the deterministic fixture.

Verified locally on 2026-10-22: DeepSeek `deepseek-v4-flash` passed shipping, product selection
and missing-evidence checks. A separate queued call recorded 385 input and 101 output tokens
and a final USD 0.0001183 charge. This is a small functional check, not a broad quality
benchmark. Luna and a public production deployment have not been verified.
