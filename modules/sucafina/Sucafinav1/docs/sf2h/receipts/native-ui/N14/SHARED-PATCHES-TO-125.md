# N14 / U03+U47 — shared integration patches to 125

Status: PROPOSED / INERT. This file is a handoff, not an edit to any shared registry, producer, router, language singleton or foreign author's files.
Origin: PR #146; branch sf-ux-n14; epoch ux-native-n14-e1.
Contracts: launch30/N14.json@b187c2b; A10 on sf-ux-a10; F01/F03/S03 pinned public signatures on sf-ux-w02/w04/w08.

## P125-N14-01 · Three existing I00 composition entries

Only the integrator modifies the shared registry and route table. Imports to add:

    import { SfPeopleOverviewView } from "@/orchestra/chapters/sucafina/people/overview"
    import { SfPeopleStructureView } from "@/orchestra/chapters/sucafina/people/structure"
    import { SfPeopleTalentView } from "@/orchestra/chapters/sucafina/people/talent"

Insert in I00 existing exhaustive surface map, without creating a second dispatcher:
- CAP06 with SfResolvedRoute<"CAP06"> -> SfPeopleOverviewView
- CAP07 with SfResolvedRoute<"CAP07"> -> SfPeopleStructureView
- CAP08 with SfResolvedRoute<"CAP08"> -> SfPeopleTalentView

F01 SfContextProvider must be above the chapter boundary. Resolved route alone grants no data access.

## P125-N14-02 · Paired language copy

    import { SF_U03_COPY, SF_U03_COPY_BR } from "@/i18n/orchestra-chapters/sf-u03"
    import { SF_U47_COPY, SF_U47_COPY_BR } from "@/i18n/orchestra-chapters/sf-u47"

In existing I00 language composition:
- en: spread SF_U03_COPY and SF_U47_COPY
- pt-BR: spread SF_U03_COPY_BR and SF_U47_COPY_BR

Do not edit frozen F03 common copy. Legacy classification/status literals remain exact and source values never become translation keys.

## P125-N14-03 · Named typed A10 operations

Register only the known operations by their existing schemas and source bindings:
- GET domain.page.CAP06, domain.page.CAP07, domain.page.CAP08.
- CAP07 POST saveCio, saveLeader, deleteLeader, saveMember, deleteMember.
- CAP08 POST save, delete, import, exportAllMembers.

Preserve current authorization, exact source record CAS, idempotency key, uncertain outcome and authorized post-commit read. CAP07.deleteLeader carries affected-member versions; CAP06 is read-only.

## P125-N14-04 · Owner-safe navigation builder (blocking)

CAP06 Open team structure requires I00/F01's same-owner validated SfHref for CAP07 entry. The current SfSurfaceProps exposes only the current resolved href, not an authorized destination builder. A leaf may not build a URL from a guessed owner query or write a second route parser.

Provide that exact builder from I00 inside the selected Server SDK/Models owner, and connect the current disabled open-team-structure action, CAP07 list -> detail/edit links and CAP08 member links. Until integrated, inline CAP07/CAP08 detail selection works but address-bar navigation is not authored; deep-link route input still renders on direct arrival. This is a real integration blocker.

## P125-N14-05 · Source-bound workbook preview and file bytes (blocking)

The producer already implements dashboard preview-workbook, including source workbook parsing/scanning, and authenticated GET download=members. Reuse these original endpoints only through F02's owner-bound typed operations/download handle. No browser parser, arbitrary fetch, mock scanner or parallel backend.

A10 CAP08.import accepts typed rows, matched versions, replace and confirmed but does not yet expose a typed source workbook preview to the UI. A10 CAP08.exportAllMembers returns SfPeopleLegacyResult ({ok:true}); application.ts discards the producer's file value in JSON POST. That response is NOT a downloadable artifact.

The integration must provide exact authorization, original scanner acceptance, preview/Replace consent, CAS for every matched row, one idempotent apply and actual authenticated byte download, preserving revocation. Until available, CAP08 /import and /export and associated controls deliberately show unavailable; do not mark positive U47-AC01 passed.

## Handoff/gates

119: Compile the integrated N14 transitive code after 125 consumes these patches; report diagnostics, no speculative compile pass.
120: Run only the two U03/U47 hosted surgical specs after integrated snapshot/isolated installed owner admission; separately prove actual 200% and 400% browser zoom, owner changes, read-only revocation and import/export positive flows when possible.
No local test, local typecheck, reset, force, dev merge, deploy, duplicate dispatcher or Goal reactivation. Recheck 125's current shared preimages and fencing before any shared write.

## P125-N14-06 · known producer rejection and F01 pending draft reconciliation (blocking)

The pinned F01 SfPublicDraftController can setPending and confirmSave but does not expose a terminal known-rejection transition. Its pending-operation invariant intentionally rejects clearing a submitted operation merely by setPhase/discard. N14's review UI therefore preserves the submitted intent and blocks retries after known 400/409/422; it can show the source error text but cannot safely move a submitted F01 draft back to editable/conflict without F01-owned reconciliation.

125 must coordinate a source-verified, exact-operation terminal rejection/rebase protocol with F01 (preserving key, source version and owner), rather than treating deterministic 409 as successful or silently retrying. Until then, U03/U47 mutation-error recovery is NOT acceptance-qualified. A pre-submit validation error still keeps its original draft; a response-loss error remains outcome-unknown. No N14-owned leaf overrides F01 private draft state.
