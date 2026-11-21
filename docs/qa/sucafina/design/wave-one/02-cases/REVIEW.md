# Wave one · UI33 Cases / Decisions

## Delivery status

**Implementation candidate only. The patch has not been applied to the application, built, rendered, or visually approved.**

[candidate.patch](candidate.patch) contains real, scoped TSX and CSS changes against the pinned native Sucafina frontend. The branch contains only this review and the patch artifact; it does not add unresolved application files to `dev`.

| Boundary | Pinned value |
| --- | --- |
| Repository | `gustavomhss/Orchestra-SF` |
| Integration ancestry | `dev` at `948fab6ef2f8bbbcf2c8a6b787755a1d5713e6e1` |
| Work branch | `sf-polish-cases`, created directly at planning commit `20bd10681b83c51d1f5d369b7a438b58d57c9f18` |
| Read-only native reference | `sf-join-four` at `fdeb988881c927f952a2d9fd5b8002c892f56635` |
| Native screen | UI33, `/orchestra/sf-decisions`, authorized case list and existing inline creation/review |
| Actual write scope | `docs/qa/sucafina/design/wave-one/02-cases/` |

The blocking condition is the one recorded in the [design plan](../../README.md): the pinned `dev` does not contain `packages/app-shell/src/orchestra/chapters/sucafina/` or its native registrations. Importing an entire development branch would exceed this design task. This candidate is ready for source review and later application to the intended native frontend import.

The legacy white/green console is outside this work. The existing HuGR Orchestra shell, chapter kit and global materials remain unchanged.

## Exact source provenance

All paths below are relative to the repository root.

| Source path | Blob SHA | Treatment |
| --- | --- | --- |
| `packages/app-shell/src/orchestra/chapters/sucafina/decisions/cases/index.tsx` | `a22b650d1388545a58f165fb0ca91c70d84071b2` | Candidate markup changes and local CSS import |
| `packages/app-shell/src/orchestra/chapters/sucafina/decisions/cases/create.tsx` | `f7b5c98e7c9521d935b81211919abf3c99f3d23f` | Candidate presentation markup only |
| `packages/app-shell/src/orchestra/chapters/sucafina/decisions/cases/n24.css` | `abe9f0eca6b62335e3aff5846700d4f4b0be35d9` | Read only; shared with other decision surfaces |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/frame/frame.css` | `2477afe718a6631d088b0244e1939e1fd398650a` | Read only; supplies the named `sf-frame` container |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/frame/presentation.tsx` | `d868f673d1bec44a24b7bd83c0163784e04a695d` | Read only; action markup and focus behavior preserved |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/states/index.tsx` | `69f2ed01a12012c21a269df16478f16bf112244e` | Read only; state roles, messages and retry logic preserved |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/states/states.css` | `1bc1027f8888e2937f4a486ecedd883803e3f0c6` | Read only |
| `packages/app-shell/src/orchestra/chapters/kit.css` | `d90cfcf2b4b5063931b663fe74bb7b8a4bec85fe` | Existing native role tokens; identical in the pinned source and `dev` |
| `packages/app-shell/src/orchestra/theme.css` | `5f557ab4917ba9a7c850cce8b265ac0900ca373d` | Existing native role tokens; identical in the pinned source and `dev` |
| `packages/app-shell/src/orchestra/DESIGN.md` at pinned `dev` | `d3338aa824af6fe7ea08853c38205e329bc6b20d` | Current design authority |

The third product path in the patch is new: `packages/app-shell/src/orchestra/chapters/sucafina/decisions/cases/cases.css`.

Repository and app-shell `AGENTS.md`, `.claude/skills/orchestra-design-system/SKILL.md` and `.claude/skills/orchestra-visual-qa/SKILL.md` were read. The current `DESIGN.md` quiet-glass decision takes precedence over the design skill's older broad blur, rim and grain language. No new glass, blur, color palette, global token or shared component is introduced.

## Source findings and design decisions

These are source findings and candidate design intentions, not observations from a running browser.

| Area | Source finding | Candidate change |
| --- | --- | --- |
| Hierarchy | `n24.css` mostly inherits body type; the shared kit declares `--orchestra-font-size-xl` for `.mx-page` and the theme defines that token as 16px. No computed UI33 measurement was obtained. | Explicit native md body, xl section headings, lg record titles and sm metadata. Only genuine case IDs and the existing code note use monospace. |
| Case list | Each record is its own padded `.mx-card`; title, reference, version and action share a wrapping flex row. | A single quiet native surface, hairline-separated rows, aligned title/ID, version and action columns. Long titles and references wrap rather than truncate. |
| Search | The filter and conditional clear action lack a stable local layout. | A named list heading and aligned search toolbar, retaining the existing visible label, placeholder and clear behavior. |
| Inputs and focus | Leaf controls use generic `--border`, `--background` and `--accent` fallbacks. | UI33-specific native fill, border, radius, type and focus tokens; 44px minimum controls without fixed heights that would clip wrapped labels. |
| Creation | The objective competes with dates and currency in the auto-fit grid. | Full-width objective and criteria; equal start/end/currency columns when space permits, one column in a narrow frame. The actual inline panel remains inline. |
| Review | Objective, period, currency and criteria form a loose paragraph/list block. | A titled review group with labeled definition-list values and a separate criteria section. The same values, trimming and criteria order remain. |
| Action priority | The header and form both retain primary styling while creation is open; after success the disabled review button remains primary. | The header trigger stays present and focusable but becomes visually secondary. The existing submit action is primary until confirmed; after confirmation the existing Open decision link receives that emphasis. |
| Narrow layouts | Shared viewport rules do not express the available workspace after sidebar allocation. | Local queries use the existing named `sf-frame` container. Rows become two columns at 767px and one column at 479px; form/review columns stack at 767px. |
| Read states | Shared state behavior is already explicit. | Keep `SfStatePanel` and its roles, loading skeleton and retry policy; only local spacing, heading scale and radius align with the list. |

The CSS is scoped under `.sf-cases`. The two header-priority rules are explicitly gated by `.sf-page-frame:has(.sf-cases[data-sf-creating="true"])` and target only `data-sf-action="new-case"`. This changes paint, not action availability or application state. The trigger is never removed, hidden or replaced, so the existing focused element remains intact.

The candidate uses existing native role tokens for all paint, type, radii and motion, and local dimensional tokens for spacing and minimum hit areas. It adds no hardcoded color, blur, movement, line clamp, hidden overflow, forced theme override or simulated row click target. The new style consumes role tokens that exist in both pinned trees. Actual palette and contrast verification is still pending.

## Behavior and copy preserved

The entire creation implementation before its returned section, including the field helper, is byte-identical to the source. The list state/filter/owner logic and the frame action configuration are also byte-identical.

In particular, the candidate retains:

- The ready owner and operation fences for `decisions.command.sf_case_draft`.
- Explicit edit → review → confirm stages, validation rules, date order and uppercase currency handling.
- The original submit handler, `canSubmit()`, all disabled predicates, pending-field locks, generation/owner checks and abort handling.
- The scoped SHA-256 pending prefix, UUID correlation, marker written before POST, no automatic replay after a lost response, and source-returned `outputRef` as the only authoritative created identity.
- Unauthorized, unavailable, invalid, unknown, confirmed and recovery message branches without substitutions.
- Native `sfDecisionHref` targets and unmodified case references, titles and version values.
- The named case-list region, listitems, `section.sf-n24-create form`, field labels, review group, criterion listitems, single live status node, action labels and frame action IDs.
- Every existing UI33 copy key. Additional headings and review labels reuse those exact existing keys; no translation catalogue is edited and no new user-facing copy is invented.

The existing literal `sourceRefs: []` remains as an understated code note. Its copy was not rewritten in this presentation-only pass. No model, transport, route, shared `n24.css`, kit, frame, palette or test file is changed.

## Review performed

| Check | Result |
| --- | --- |
| Unified patch hunks replayed in memory against the fetched pinned source contents | Exact reconstruction of the three authored candidate files |
| Candidate source prefix comparison for creation logic and field helper | Byte-identical |
| Candidate source comparison for list logic and frame actions | Byte-identical |
| UI33 copy-key set comparison | Same existing key set; no new keys |
| Named region, form, field, review, status and native-link contracts | Preserved by source inspection |
| CSS references | All variables resolve to local definitions or existing native token definitions in the inspected source |
| CSS isolation | All rule blocks start under `.sf-cases` or the explicit UI33-gated frame selector |
| Source/runtime compilation, repository tests, browser execution, screenshots and contrast measurement | **Not run** |
| Applied application UI or visual approval | **Not delivered** |

The in-memory hunk check is artifact integrity verification, not `git apply`, a TypeScript build, a product test or visual QA. No terminal, local tests, CI workflow, PR, merge or baseline update was run.

## Existing regression coverage to run after native integration

These sources were inspected; none was modified or executed.

| Path | Relevant coverage |
| --- | --- |
| `packages/app-shell/e2e/sucafina/decisions-native-authoring.spec.ts` | `native Decisions preserves a created and edited case through reload and reopen`; `native Decisions reconciles one lost creation response by authorized reads` |
| `packages/app-shell/e2e/sucafina/decisions-support/case-lifecycle.ts` | Both authoring journeys, source-backed creation, reload/reopen, exactly one POST after a lost creation response, preserved disabled draft and authorized read recovery |
| `packages/app-shell/e2e/sucafina/decisions-support/journey.ts` | Exact New case, field-label, review-group, confirm, named case-list region, reference, objective and Open decision selectors |
| `packages/app-shell/e2e/sucafina/native/visual.spec.ts` | Q02-AC01 installed `sf-decisions/UI33` dark/light baselines and shared palette/focus checks |
| `packages/app-shell/e2e/sucafina/native/accessibility.spec.ts` | Q02-AC02 UI33 at 1024px and UI33 400% layout-equivalent reflow at 320px; focusability and document overflow checks |

The existing Q02 200% text-only case targets CAP25, not UI33. First-wave UI33 captures at actual 200% and 400% zoom remain required; the existing width-equivalent test is not evidence of actual browser zoom.

## Remaining integration and visual gates

1. Resolve the intended native frontend import on the `dev` lineage. Verify the listed source blobs and re-review the patch if the imported UI33 has changed.
2. Apply the bounded candidate and run the repository-required hosted type, regression and palette checks through the approved CI workflow. `DESIGN.md` requires palette generation after stylesheet work; the existing generator uses a fixed source list without these Sucafina leaf files, so role-token inheritance and generated-theme results must be checked during integration. No generated palette file is edited here.
3. Review the real installed native screen in dark, light and generated palettes with long source titles/references, filtering, clear, loading, empty, filtered-empty, errors, revoked access, creation review, cancellation, pending/unknown recovery and confirmed creation.
4. Check desktop, narrow workspace and actual 200%/400% zoom: no document horizontal overflow, readable dates and IDs, visible focus rings, reachable actions, wrapping labels and comfortable spacing. Verify `:has()` and container-query behavior in the supported host browsers.
5. Capture and review real before/after screenshots, measure text/focus contrast over the actual background, and obtain explicit visual baseline approval. Do not create approval metadata or replace baselines from this unrendered candidate.

The maximum design bar remains the acceptance target. This source-only candidate does not establish that the rendered screen meets it.
