# WP01 → WP10: authorized main-refresh lifecycle

## Published inputs reconciled

- Proposal: compose `5866bcb2ed610f80138aaabc261acac4acf709cd`, `modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/owner-patches/wp01-client-refresh-seam.patch`, blob `041fbe2a9302f6ed69555ddfda72081b6207d795`.
- Findings: PR31 comments `6874899452` and `6874959979`.
- PR32 current head read through GitHub MCP: `4306b310e4d6dac77f9beab461adad4e8e924849`.
- At that head, `product/interface/bi-entry.ts` blob `305ee63cd74658f6665a6ebbca885fe5995ea95f` and `apps/cli/src/sucafina-product/extended-bi-browser.ts` blob `e109061a32e07d6ddfd1b7ae40d8ceae380beed7` do not register `sucafina:main-refresh`.
- Current `product/integration/bi-http.ts` blob `23c183666cef9d97925ba05c67fe678d9b058255` reauthorizes its `sf=bi` document through the real UI authority, then renders the shell. Its document does not expose an access-revision meta/header. Therefore a successful shell GET does not establish that a previously rendered BI projection or selection is still authorized.

## WP01 implementation

`modules/sucafina/Sucafinav1/src/screen-shell.ts` offers a synchronous, cancelable `CustomEvent("sucafina:main-refresh")` on the existing `<main>` after the normal `refresh()` authorization checks and before replacing it. It has no detail payload and does not bubble.

Admission requires:

1. A successful current-generation document read after the existing 401/403, signed-out, access-revision, and `data-drawn=false` checks.
2. No active write, dirty form, open dialog, retained unknown-result view, or focused form.
3. A nonempty, equal `data-page`, `data-drawn="true"` on both mains, and equal body surfaces.

A synchronous `event.preventDefault()` retains the current mount and consumes the pending shell document. Otherwise the existing full-main replacement and `attach()` behavior remain. The 30-second timer, read timeout, foreground policy, refresh button, access-revocation handling and mutation generation fences remain in place.

## Required WP10 consumer behavior

- Register on the live enclosing `<main>` (or in a capture listener); the event does not bubble. Claim it synchronously only when that connected mount owns the exact current BI view.
- Coalesce or cancel older BI reads. The event is a refresh request, never an authority assertion or permission to reuse projection contents.
- Re-read authorized current options/selection and the actual BI reader for the retained period/view. Keep user selection only when the reader establishes its current validity. Do not fabricate a new scoped reference or infer continuity from a label/text ID.
- Hide/clear protected stale results while their new authority is unresolved. Purge results and private selection when authorization is denied, source identity disappears, `sf-access-revoked` occurs, or the mount/page is removed. Abort outstanding reads and prevent late responses from repopulating detached/revoked DOM.
- Preserve filters and useful focus only after the actual reader succeeds; expose a recoverable unavailable state for failed reads. Do not mark the workspace with `data-sf-retain-view` merely to suppress periodic refresh forever.
- Regenerate the consumer's normal browser bundle/CSP through its existing build process after changes. No foreign consumer or generated bundle was edited by WP01.

## Own proof and integration boundary

New `test/product/wp01/shell-refresh.test.ts` uses the actual operator enrollment/authenticator, encrypted SQLite sessions, source persistence, application route and browser shell. Its event listener only records the emitted event; it never cancels it or substitutes for a BI consumer.

- Real 30-second foreground refresh performs an authorized GET, emits the cancelable event, replaces unclaimed content with changed persisted data, and reattaches the actual editor. No virtual clock or replacement BI reader is used.
- Dirty form blocks the lifecycle handoff, while real logout still revokes and purges the page.
- A real save followed by damaged delivery remains uncertain and retains later edits across refresh; the database shows one effect and no replay.

These tests are authored, not locally executed. They require the existing explicit startup-first/finalizer-last Actions lifecycle. They do not prove positive BI retention, BI reauthorization, or WP10 integration. Those require the actual published WP10 consumer and its affected browser selection.

## Frozen working-tree blobs

- `src/screen-shell.ts`: `d69bb554ba35863b0bf248c6aa0382205614d12a`.
- `test/product/wp01/shell-refresh.test.ts`: `8fca620410456af1ad786ee9f7739ff5642b19b7`.
- `test/product/wp01/README.md`: `9d191a1556c7a3a57be3a4426d2de597b9c12538` (19 direct pool consumers, including the new test).

The real OPEX renderer enumerates all 12 months with `index + 1`; the form with record `jan` and the first deviation form therefore address January independently of the request's default current month. Its persisted deviation key is `deviations:opex-owner-1-2026-1`, matching the existing shell-recovery fixture.

No test, typecheck, guard, build, browser or product process was executed locally. `git diff --check` on the owned tracked shell path passed; the new test was inspected as source. Parent publishes and runs the surgical Actions selection.
