# Visitor moderation

**English** · [فارسی](visitor-moderation.fa.md)

## Names, flags and pages

In a conversation's visitor information panel, enter an internal display name and save it.
This alias is separate from the name supplied by the website or WordPress. Mira displays
the alias first, then the website name, then the visitor ID. **Return to website name**
clears the alias without changing the original name.

Add up to eight internal flags, with a title and one of six colors. Flags identify the
visitor across their conversations; conversation tags remain separate. Tags have colored
chips, and high-priority conversations have a visible priority marker.

The page card shows the latest reported title, host and path. The conversation's entry
page is shown separately. These are reported activity values, not proof that the visitor
is still looking at that page; “online” means activity within the last five minutes.

## Block and mute

Use **Block visitor** in the chat header for a permanent or temporary block. **Mute visitor**
offers 15 minutes, one hour or 24 hours. A reason is optional. Confirm the restriction in
the dialog. Unblock or unmute from the same controls.

Both restrictions stop new visitor messages, conversation starts and typing events on the
server. Existing history remains readable, and operators can still reply. The widget shows
the restriction and its expiry, preserves the visitor's draft and receives later changes
without a page reload. A temporary restriction expires automatically.

Restrictions apply to this visitor identity in this store. They are not IP-wide bans.

## Spam protection

In **Settings → Operations**, enable or disable automatic spam protection and choose a block
duration from 1 to 1,440 minutes. Protection is enabled by default, with a ten-minute block.

A visitor is temporarily blocked after six repeated normalized messages within 15 seconds,
or fifteen messages within ten seconds. Retrying an already accepted message with the same
client message ID does not count again. Windows are independent for each visitor and store.
This detects repeated messages and bursts; it does not classify message content, and someone
who changes their browser identity may appear as a new visitor. A manual block is preserved.

## Trash and restore

**Move to trash** asks for confirmation and removes a conversation from the active inbox.
Messages are retained. Select **Conversation folder → Trash** to restore it; viewing its
messages requires restoration first. This action does not permanently erase visitor data.

Trashing a conversation pauses AI. Restoring it leaves AI paused. If the visitor has started
another active conversation meanwhile, the restored conversation becomes resolved history,
so there is still only one active conversation for that visitor.

## Permissions and implementation

Administrators have these controls. Other agents need `moderateVisitors` to change aliases,
flags or restrictions, and `deleteConversations` to trash or restore conversations. Existing
agents do not receive these permissions automatically. Every operation is scoped to the
current store.

Migration `1737301300000-VisitorModeration` adds visitor moderation metadata, conversation
trash fields and lifecycle versions, and store spam settings. API and worker releases must
be updated together. Restriction changes and trash/restore increment versions: queued or
in-flight AI work from an older version is discarded even after unblock or restore. Legacy
jobs without versions are treated as version zero. No database row lock is held during a
model request.

## Verification status

Local checks passed: all workspace builds, ESLint, 142 unit tests, 70 real-Postgres
integration tests and ten existing Chromium scenarios. Moderation browser coverage verifies
names/flags, draft preservation, restriction updates and reconnects, tenant/permission
boundaries, recoverable trash, idempotent retries and fifteen concurrent messages triggering
one durable spam block. All eleven selected Chromium scenarios passed.

Commit `6de5581` was deployed to mira.hami9.ir with a database backup and matching API/worker
images. A disposable production tenant verified aliases/flags, block/unblock, rejected
visitor starts, hidden deleted history, restore and migration presence, then was removed.
The API is healthy, the worker is running and the public widget hash matches the deployed
bundle. No real customer conversation was changed during verification.
