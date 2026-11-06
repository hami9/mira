# Chat tools

**English** · [فارسی](chat-tools.fa.md)

Operators and administrators can send a page or product link as a card from the composer.
Paste a complete HTTP(S) URL to expose the card shortcut, then review its title and description.
Mira does not fetch arbitrary pages or invent product prices/images. The ordinary draft is retained.

The form library supports eight ordered fields: text, long text, email, phone, select and
checkbox, with required controls. Both roles can create/send forms; creators edit/archive
their own templates and administrators manage all templates in their store. Sent forms keep
an immutable snapshot, even when a template changes. Answers submit once, persist as message
metadata and appear inline. They are excluded from ordinary AI history and automatic webhooks.
Blocking, mute and trash also prevent submissions. All records are scoped to the signed-in store.

Migration `1737301400000` adds `chat_forms` and `messages.toolMetadata`. API, widget and dashboard
must be released together; the worker accepts generic message text without reading form answers.

WooCommerce account context now requires the updated WordPress plugin. Logged-in customers,
administrators and shop managers are shown even without orders. A site-bound HMAC proof expires
after 15 minutes; reload the store page to renew it. A browser-supplied email alone cannot expose
orders. Logout/unsigned sessions clear the binding. Not configured, guest/unverified, unavailable
and not found are distinct UI states. Keep the plugin's private API key configured on both sides.

Verification includes PHP syntax, three disposable WooCommerce account roles, identity unit
checks and a real-Postgres test for form snapshots, concurrent submissions, tenant boundaries,
link validation, restrictions and idempotent retries. All builds, widget TypeScript, ESLint,
144 unit tests and 71 integration tests passed. Real Chromium checked the operator form/link
flow, persistent submission, restrictions and 375/768/1280px layouts.

Commit `b52c93c` is deployed at mira.hami9.ir in `mira-api:chat-tools`; the worker remains on
the compatible moderation image. Production smoke used and removed a disposable tenant,
checking form creation/send/submit, link cards and previous moderation operations. A database
dump and prior override are retained under `/var/backups/mira/chat-tools-20261106`. The API is
healthy. Popmobile's WordPress URL/key are configured, but installing plugin 1.5.3 on that
separate WordPress site remains an owner action; it was not installed there by this release.
