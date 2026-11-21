# Wave four — Planner and personal work

Status: implementation and executable journeys authored. Remote production build, guard results and visual approval belong to the consolidated wave-four Actions evidence. No runtime or screenshot pass is claimed here.

## Scope and composition

| Area | Native route | Reading and editing composition |
| --- | --- | --- |
| CAP20 | /orchestra/sf-planner/headcount | Source plan summary, expandable position ledger, focused position editor with a local twelve-month cost table, rate ledger and source settings. Review occupies its own bounded surface. |
| CAP21 | /orchestra/sf-planner/allocations | Two full-width shared catalogs. Detail, distribution editor and change review are distinct stages. Returning to the catalog restores the mounted filter. |
| CAP22 | /orchestra/sf-planner/fx | Fixed USD reference, exchange-rate ledger with provenance, and explicit missing-rate notes. The provenance editor and review replace the reading stage. |
| CAP23 | /orchestra/sf-planner/versions | Version ledger, bounded editable record and source-copy choice. The current source state and expected revision remain part of review. |
| CAP23 comparison | /orchestra/sf-planner/versions/compare | Two independently authorized source selections, five source metrics, twelve monthly source rows and two named keyboard-focusable local scroll regions. |
| UI30 | /orchestra/sf-work | Period and source selection, work ledger, then a bounded current-source detail. Return to list leaves the filters mounted. |
| UI31 | /orchestra/sf-search | A joined query/result surface, type filter, result rows and disclosed source context. Authorization guidance appears once below the list. |
| UI32 | /orchestra/sf-views | Existing source views, focused editor, then review. Return to list keeps the owner-scoped draft available when the record is reopened. Unsupported V2 creation and preferred entry remain explicit. |

## Native visual contract

Every root, including the external CAP20 review, carries data-sf-wave="four". The shared frame owns the 1160px width and 32/24/16px responsive gutters. This group does not redefine the page frame or glass recipe.

The group uses the native mx-sans font, Orchestra type/radius/color tokens, mx-raised and mx-line materials, 44px controls, 760px editor/review bounds, local horizontal scrolling and visible focus rings. Below 620px, multi-column forms collapse. At 320px, review actions and form actions stack vertically. The existing shell owns dark/light switching.

The presentation foundation is planner/versions/planning.css, imported only by the assigned Planner and personal-work styles. Surface-specific rules define ledger, form and evidence layouts. The hidden attribute wins over grid declarations so hidden reading/editor stages do not remain interactive.

## Interaction and source invariants

- Existing English dictionary values and keys are unchanged. BR catalogs u08/u09/u45/u46 are explicit translations; u41/u42/u43 were already localized.
- Source owners, route validation, authorization, version checks, command identity, pending outcomes, F01 drafts, source confirmations and original receipts are unchanged.
- Reviews capture their admitted object through a keyed Solid Show. Cancel, revise and confirmation can unmount the review without dereferencing a retired conditional accessor.
- CAP20 rate field labels use the existing currency/locations keys. No new source copy or invented rate unit is introduced.
- Zero remains a recorded value. Missing rates and absent source values remain visible as missing.
- CAP20 roster sync stays blocked when the original producer supplies no impact preview.
- CAP21 catalog classification does not imply a cost posting. A configured allocation remains subject to the source's exact 100% validation.
- CAP22 provenance, timestamp and rate validity remain producer-owned. The UI does not perform conversion or invent an observation.
- CAP23 copy is an original source command. Comparison reads each selected source and rejects a defaulted or different-year selection.
- Search stays a private read through its original body contract. Work destinations are reauthorized before opening. Saved views remain private V1 records and confer no destination authority.

## Deliberate limits

The native view-creation/preferred-entry V2 capability is unavailable in the existing contract. The UI retains that limitation rather than presenting an invented save path. The wave does not add a roster preview, currency conversion, cost distribution, grant path, router exception, allowlist entry or producer schema.

Remote screenshot review must still judge actual type hierarchy, table density, long labels, review scroll and material in both schemes. Authored reflow checks are evidence only when the maintained Actions runner executes them.
