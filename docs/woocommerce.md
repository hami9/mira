# WooCommerce

**English** · [فارسی](woocommerce.fa.md)

Save the WordPress HTTPS URL and matching Mira plugin API key in Settings → Install.
Use **Test connection** to check the saved configuration. Administrators and operators with
`manageSiteSettings` can run the check. It distinguishes missing configuration, rejected keys,
unavailable WordPress and an older plugin that needs updating. No credentials are returned.

Plugin 1.5.4 exposes authenticated capability diagnostics. Products and public pages supply
AI context; a signed, unexpired WordPress identity enables customer/account and recent order
details. Customer, administrator and shop-manager accounts are recognized without orders.
Lifetime spending uses WooCommerce's paid-order total instead of summing the ten recent orders.
Requests without an identity are rejected rather than querying unrelated orders.

Install the updated `wordpress-plugin/mira` directory on the customer WordPress site; deploying
Mira alone does not update that installation. Keep the existing plugin settings and shared key.
Cart writes, checkout and payment-provider configuration are not implemented by this integration.

## Knowledge

Custom theme pages can have empty WordPress `post_content`. Import their verified public terms
into the knowledge base instead of assuming the pages API contains the rendered content.
Documents must finish indexing before they can be retrieved by the AI. Provider billing failures
leave them saved but unavailable to retrieval; reindex after credit is restored.

## Checks

`tests/unit/wordpress-diagnostics.test.ts` checks response states and network restrictions.
`tests/e2e/woo-status.spec.ts` exercises the real API, fresh permissions and mobile dashboard.
`tests/fixtures/wordpress-diagnostics.php` checks a disposable WordPress/WooCommerce installation,
including missing identity and lifetime totals across more than ten orders. Never use customer
accounts or production orders for that fixture.
