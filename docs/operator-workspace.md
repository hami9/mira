# Operator workspace

**English** · [فارسی](operator-workspace.fa.md)

## Stores

Sign in to a store, choose **Add store**, and sign in to the next store's operator account.
The selector shows each store's name and unread message total. Background messages include
the store name and a shortcut to its inbox. Counts include conversations outside the current
list page and filters. Reading a conversation updates only the current operator's count.

Each store has a separate API client, Socket.io connection and in-memory credentials. Switching
unmounts the previous store's views. Logging out of one store leaves the other accounts signed
in; logging out of all stores clears them all. Reloading the page requires signing in again.
This is account switching, not a shared membership or account-provisioning service.

## Visitor activity

Visitor lists show the current reported page, the entry page of the latest conversation and
last activity time. **Start conversation** creates a human-owned chat, or opens the visitor's
existing open/pending chat. It does not reassign another operator's conversation. The first
operator message opens the visitor's widget and is delivered without a reload.

The conversation's information panel separates the current page from its entry page and
provides safe HTTP/HTTPS links. New widget conversations snapshot their starting URL and title;
operator-created conversations snapshot the latest reported page. Historical conversations
without that information display an unknown value. The migration does not invent old entries.

The widget checks page changes every five seconds, including SPA navigation. A visible tab
sends a heartbeat at most every 45 seconds; unchanged pages do not create duplicate history.
The information panel refreshes every ten seconds and the online list every fifteen seconds.
These are last reported values, not proof that a customer is still looking at that page.
“Online” means activity during the last five minutes.

## Knowledge

In **Settings → Knowledge**, add text or drop/select a UTF-8 `.md` or `.markdown` file.
Each file can be up to 64 KiB. The editor accepts at most 80,000 UTF-8 bytes and twenty keyword
phrases of sixty characters each. File text remains plain text; Mira does not execute Markdown
HTML or fetch links in it. One source contains one file. Sources can be edited, searched,
downloaded as Markdown, disabled, deleted or retried after a processing failure.

Active sources are chunked and embedded through the queue. Title and keywords participate
in the embedding input; changing them or the content schedules a new revision. This can incur
provider charges. A disabled source is stored without starting embedding work. Only active,
ready sources participate in retrieval. Versioned jobs and transactional chunk replacement
prevent an older embedding from replacing a newer edit.

The usage count is the number of persisted answers citing that document, counted once per
answer even when several of its chunks are used. Hiding public citations does not suppress
the count. Multiple sources can count the same answer. Counters start at this version and are
not reconstructed from historical messages. Disabling or changing a selected source during
generation prevents its old answer and hands the conversation to a human.

## AI and system controls

Settings has separate tabs for AI, knowledge, installation, operations, usage, system and
account security. Tabs follow the current operator's permissions. Billing loads in its own
tab; installation-wide resource checks run only on request and require the bound host admin.

The guardrail switch controls store-specific blocked topics, retrieval similarity and model
confidence thresholds. It defaults to enabled. Disabling it does not disable tenant isolation,
source/product validation, sensitive-output filtering, input size limits, reply budgets or
human handoff. Those controls are enforced independently.

Migrations `1737301000000` and `1737301100000` add conversation entry context and knowledge
controls. They retain existing content and conversations. All shipped self-hosted features
remain free of Mira subscriptions; AI provider and hosting charges are separate.

## Images and widget

Assistant identity and operator profiles accept PNG, JPEG or WebP files up to 10 MiB instead
of asking for an image URL. Move or zoom the circular preview, then confirm to save the image
immediately. The browser crops locally; the server independently decodes, validates, masks
and resizes the result to a 256-pixel PNG. SVG and animated images are not accepted. Public
avatar links are needed for visitor display; do not upload private documents as an avatar.
Existing image URLs remain compatible. Migration `1737301200000` adds one bounded avatar
record per owner and store in PostgreSQL, so Lite installations need no extra storage service.
Replacing an image replaces its stored bytes; store/account deletion cascades to its records.

The widget has a rounded floating panel, compact multiline composer and motion for incoming
answers, product cards and real queue status. Animation does not simulate model reasoning or
streaming. Reduced-motion preferences stop the animations and smooth scrolling.
