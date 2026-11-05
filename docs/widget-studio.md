# Widget Studio

**English** · [فارسی](widget-studio.fa.md)

Status: implemented and locally verified with 142 unit tests and three Widget Studio browser
checks. Broader verification and server deployment are tracked separately.

## Use

1. Open **Settings → Widget Studio**. In **Brand identity**, set the store and assistant names,
   greeting and image. Confirming an image crop saves it immediately; other edits remain drafts.
2. In **Appearance and motion**, choose a preset or adjust colors, layout, launcher and
   animations. Defaults are `breathe` for the launcher and `rise` for the panel. Attention
   animations finish within 4.5 seconds and respect reduced motion.
3. Edit and move welcome cards and quick actions. Each can send a prompt, open a safe HTTP(S)
   link or request a human. Feature toggles control what the actual widget displays.
4. Check desktop and mobile in the real-widget preview. Its callbacks are local and create no
   chat session or socket. Restart the preview or replay animations to inspect the chosen state.
5. Export or import a version-1 appearance template. It contains no IDs, tokens or avatar URLs;
   importing updates the draft without publishing it. Discard restores the saved configuration.
6. Select **Save and publish** to apply the remaining changes. Visitors see the published
   configuration after reloading their chat. Unsaved drafts are kept in memory per store while
   navigating the app; they do not survive a browser reload or close.

The remaining sections retain the original implementation plan as a record of scope and design.

## Goal

Give each store a no-code Widget Studio in Settings. A store can shape its own chat identity,
welcome flow and layout while keeping the existing live-chat, AI and tenant boundaries.
Reuse the current widget instead of building a second renderer that can drift from production.

## Controls

- Identity: assistant name, existing logo/avatar upload, primary and accent colors, welcome text.
- Layout: panel size, corner radius, density and launcher appearance.
- Motion: launcher `none`, `breathe`, `float` or `ripple`; panel `none`, `rise`, `scale` or
  `reveal`. Defaults are `breathe` and `rise`. Attention animations stop within 4.5 seconds
  and respect reduced-motion preferences.
- Welcome: up to six ordered cards and eight quick actions, each using a supported prompt,
  HTTP(S) link or human-handoff action.
- Features: visibility of product cards, sources, answer copy, fullscreen, suggested replies
  and the human-handoff control.
- Workflow: presets, explicit save, discard and reset, plus versioned JSON import and export.

Preset selection, reset and import update the local draft. Save persists it; discard restores
the saved configuration. The existing avatar upload saves immediately, so the Studio must
state that discarding the draft does not undo an uploaded image.

## Contract

Use the flat version-1 `WidgetAppearance` schema in
`packages/shared-types/src/widget-appearance.ts` inside the existing `appearance` JSON field.
It includes `motion.launcher` and `motion.panel`; no database migration is needed. Shared
normalization and strict parsing define supported fields, defaults, limits and action types;
existing color and position settings remain compatible. Normalize legacy data when reading it
and validate every write on the server.

Keep configuration tenant-scoped and require the existing site-settings permission to save.
Public widget sessions receive only the safe display configuration. Feature visibility changes
presentation; it does not grant access to backend operations or disable authorization.

Imported files contain appearance configuration only. Reject unsupported versions, malformed
values and unsupported action types; bound file size, text lengths and collection counts.
Exports exclude site or visitor IDs, tokens, credentials and logo URLs. Link actions accept
HTTP(S) URLs without embedded credentials. Treat labels and prompts as plain text. There is
no custom CSS, JavaScript or arbitrary plugin execution.

## Preview

Render the actual `WidgetUi` in a controlled same-origin iframe using its internally injected
`Document`; this is not a separate app connected through `postMessage`.
Desktop and mobile preview sizes use the same normalized draft as the runtime. Preview
callbacks run locally: no visitor session, API request or socket is created, and interactions
must not navigate the Settings page. Show representative local states so layout, actions and
feature toggles can be reviewed before saving. A replay control previews the selected launcher
and panel animations without changing the draft or creating a live chat session.

## Delivery

1. **Contract — root:** implement shared normalization and strict validation, tenant-scoped API
   persistence and safe public-session configuration.
2. **Runtime — widget coder:** apply the schema in `WidgetUi`, preserve existing chat behavior
   and support an injected `Document` for the preview.
3. **Studio — studio coder:** build the Settings tab, draft workflow, ordered controls,
   presets, import/export and real-widget preview. Runtime and Studio work can run in parallel
   once the contract is stable.
4. **Verification — root:** run real-database and browser checks for persistence, tenant
   isolation, legacy defaults, draft behavior, preview isolation, imports, safe links,
   responsive layouts, animation persistence and replay. Check the 4.5-second attention
   limit and reduced motion. Review the changed runtime paths and public payloads.
5. **Publish:** record actual results, build release assets and publish the reviewed change.
   Deploy through the configured server path and verify the installed widget before claiming
   deployment is complete.

## Later work

Cart, account and order actions belong to a later integration phase with explicit trusted
contracts, authentication and tenant checks. The Studio exposes only actions supported by
the current runtime; it does not simulate those integrations or make them available through
imported configuration.
