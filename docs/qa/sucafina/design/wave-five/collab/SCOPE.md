# Wave five · collaboration and import candidate

Base: `d3ccea42b5f8409c8d6c68e4909f7b868b50322c` (pinned dev). Working branch: `sf-next-collab`.

## Selected areas

| Area | Original routes | Composition |
| --- | --- | --- |
| UI51 · Record relationships | `/orchestra/sf-work/relations/new`; `/orchestra/sf-decisions/:caseRef/relations`; `/orchestra/sf-work/relations/:relationRef` | Source lookup, list, explicit evidence editor, create review and removal review |
| UI52 · Discussion | `/orchestra/sf-work/threads/:threadRef` | Source/period summary, original messages, composer and provenance |
| UI53 · Confirm no change | `/orchestra/sf-work/confirmations/:selectionRef` | Material, separate review, original receipt and current validity |
| UI55 · Import file | `/orchestra/sf-imports/new` | Destination/period, file/options, scanned simulation |
| UI56 · Import preview | `/orchestra/sf-imports/:manifestId/preview` | Original reference, domain impact, field provenance and owner-bound continuation |

The `/:manifestId/review` route belongs to UI57. UI57 result/history and UI68 exports remain outside the visual scope. The shared import entrypoint marks only UI55/56 with `data-sf-wave="five"`. Its neutral `display: contents` manifest wrapper preserves the original layout on UI57. Apply is not invoked by the visual journey.

## Native design decisions

The current `packages/app-shell/src/orchestra/DESIGN.md` quiet-glass specification takes precedence over the older broad-glass skill wording. The existing frame supplies the 1160px maximum and 32/24/16px gutters. The leaves add no glass layer, palette, wallpaper, shell metrics or fonts.

Native raised/soft surfaces, 20px panel padding (16px below 767px), 16–20px gaps and 44px minimum controls establish the work areas. Explicit relationship editing and confirmation review use 760px maximum widths. Evidence uses the native mono role; human discussion uses native sans. Desktop columns collapse at narrow widths. Disclosure chevrons remain visible in their flex layouts.

- Relation review hides the ordinary workspace while leaving the explicit draft mounted. Cancelling creation restores target focus and raw evidence. Cancelling removal resets only S05's list-local request fence and restores its remove control; the explicit editor remains mounted. Original CAS, source evidence, idempotency and destructive confirmation remain.
- Discussion preserves its original messages, source scope and unsent draft while opening provenance. No reply is posted during qualification.
- Confirmation presents the original material before the final action. Scope, coverage, fingerprints, receipt and source validity remain producer-owned.
- Import keeps the native FileList/options mounted during preview and restores them on cancel. The current step follows the actual destination/preview state. Only one Cancel preview action remains.
- Preview retains original domain impact, changed/unchanged/ignored/rejected records and the original UI57 continuation.

## Source availability repair

Hosted attempt 2 exposed a pre-existing native admission gap: the original collaboration HTTP producers succeeded, but UI51 was denied before its leaf mounted. Attempt 3 recorded actual `ctx.context`: `collaboration.relation-read`, `collaboration.thread-read` and `collaboration.confirmation-project` were all `operational-source-unavailable`.

The existing `work-route.tsx` gate and operation registry are unchanged. Root expanded this work to the new `apps/cli/src/sucafina-product/native-ui/collaboration-reading-health.ts` and focused test. Root owns its `host-context.ts` composition.

The observer selects the original mounted HTTP producer and exact method dependencies, obtains the original request-bound human admission, reads only metadata from the canonical C08 state reader twice, and revalidates access, source identity, incarnation and revisions. Write observations also require the original installed transaction pair and the original human action's write authority. Selected record/evidence/recipient/CAS checks remain in the original handlers. No readiness is inferred from a callable method or catalog entry, and no mutation, selection, message or receipt is executed by the observer. Every admitted lease is finished; readiness is checked again after finish.

The focused test uses original SQLite storage, C08 and UI lease factories. Its 18 cases cover unchanged storage, original read/write separation, three exact read admissions, namespace denial, changed dependencies/access/revisions, abort/error cleanup, disposal, an unregistered reader and uninitialized source state. Runtime results are recorded separately; adding the test is not proof that it passed.

## Original journey boundary

The two independent tests in `packages/app-shell/e2e/sucafina/design-wave-five-collab.spec.ts` run only through the existing `test-ci` workflow and production config.

The import test uses the root-owned `four-files` installation variant. Its private helper invokes unchanged `script/sf-ci/operations-clamd.sh` on this repository's hosted Linux X64 runner. Real ClamD 1.5.4 must pass PING and the original INSTREAM adapter; the native host independently probes that adapter. Cleanup removes only the exact container ID printed by this test's own Docker start.

The workbook proposes one value against an ID read from the original Planner grid. The browser submits real XLSX bytes to the original scanner/admission/preview. The test captures the real admission at Chromium's response stage without replaying multipart bytes. For preview/reference JSON it reuses the repository's existing `forwardOnce`: each request reaches the original producer exactly once with zero retries and redirects, then the same status, headers and bytes are delivered unchanged. No source data, acknowledgement or receipt is synthesized. It also independently re-reads that producer-issued reference through the authenticated API, checking its byte digest, preview state and unapplied status, and requires the actual native reviewing UI. This instrumentation addresses Chromium response-cache loss and is recorded separately from uninstrumented delivery.

The separate collaboration test uses the original fourth-wave installation. An original Handoff creates its relationship; original authenticated APIs create one unaddressed internal comment and one case. The UI leaves the reply unsent, cancels relation reviews, and can record one no-change confirmation against freshly prepared current material. No external message, email or notification is sent.

## Localization

Every existing English key and value is preserved. New copy has English and Brazilian Portuguese values. Forty existing pt-BR import labels used by UI55/56 are corrected from English; their catalog is shared, so UI57 may also show those language corrections. UI57 markup/behavior is not redesigned.

Terminology references:

- Mozilla Firefox pt-BR `browser/browser/migrationWizard.ftl`, blob `583c89c27b52a76f72340956c7f5911bdf61e9f8` in `mozilla-l10n/firefox-l10n`.
- Microsoft VS Code pt-BR `translations/extensions/vscode.git.i18n.json`, blob `fd1594a7c7c52b3726d0d5266f50d402029181d2` in `microsoft/vscode-loc`.
- Existing native `sf-s05.ts` and `sf-u44.ts` glossary.

Planner, XLS, XLSX and JSON remain names. Source IDs and record values remain original data.

## Evidence and approval boundary

Failed attempts are preserved under `attempts/` with source and snapshot SHAs. Their screenshots are actual Actions captures, not mockups. Canonical PNGs remain attached to the workflow; bounded JPEGs are persisted here for review.

390px CSS reflow is measured separately from browser zoom, which is not measured. Passing runtime evidence, visual review and human design acceptance are separate. No user acceptance or golden-image approval is inferred.
