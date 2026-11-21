# Wave three — People and portfolio review

## Final result

The five assigned native areas are implemented and visually reviewed. Product head `a255f23fd86a083a0295acd0a08f1be3519da7d0` is included in the final People5 snapshot `579e1d4bd85221d0dd2a527f8f09a3ceb37e1408`. [People5](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44942301625) passed both real browser journeys: **2 passed, 0 failed, 3.9 minutes; 58 complete captures covering 28 business states in five areas; three confirmed browser writes with source rereads**. All four browser-context diagnostics reported no page or console errors. This final report changes documentation only.

## Scope and baseline

CAP06 People overview, CAP07 Team Structure, CAP08 Talent Review, CAP09 Portfolio Dashboard and CAP10 All Projects. Branch `sf-polish-people` starts at `24c02f7f366ecea94a8511c88cdaf2bebcb46be6`, the scope commit descending directly from the approved `dev` baseline.

This change is confined to native Sucafina presentation. The existing Orchestra shell, legacy renderer, source producers, owner resolution, transport, grants and shared frame implementation are outside this group's changes.

## Presentation decisions

| Area | Result |
| --- | --- |
| CAP06 | One quiet headcount band, reported figures kept intact, followed by the leader breakdown in a single readable surface. Missing metrics stay absent. |
| CAP07 | CIO profile, leadership assignments and searchable member ledger. Dedicated member/leader detail, grouped editor, original change review and deletion confirmation. |
| CAP08 | Searchable talent ledger with translated source enums, dedicated member detail and grouped assessment editor. Import/export routes explain their distinct unavailable bindings honestly. |
| CAP09 | Project filters, three source-list counts, project ledger and milestone schedule. Recorded source context is available next to the overview without occupying the main reading hierarchy. |
| CAP10 | Collection and record detail occupy separate stages through the existing list/detail component. New/edit forms and reviews occupy a bounded stage. Milestones expand individually and commands have a record-specific review. |

The common frame uses `data-sf-wave="three"` and a CAP06–CAP10 `data-sf-surface` marker. The integration owner supplies the accepted 1160px frame and 32/24/16px gutters. Local surfaces use the existing raised/soft materials, native font scales, native radii and accent focus. No font, palette or blur architecture is introduced.

## Geometry and interaction

- Panels use 20px content rhythm and 12px secondary gaps. All regular inputs, selects and buttons have a minimum 44px block size.
- People details, editors, deletion reviews and workbook explanations are bounded to 760px. Project editors, command reviews and milestone work are also bounded to 760px.
- People forms group identity, employment and assessment fields. Notes span the form width.
- At narrow usable frame widths, member/talent ledgers become vertically labeled records. Labels and row actions remain visible.
- Portfolio tables retain their native, bounded horizontal scroll regions; page and document overflow must remain absent.
- Project save review replaces the editable fieldsets with the exact current/proposed values. The mounted draft and form persist through review and revision.
- Collection controls remain mounted behind the active record/editor stage. The existing project list/detail component retains selection focus and list scroll restoration.
- Destructive commands identify the actual selected person, project or milestone before confirmation.

## Source and command fidelity

People reads remain `domain.page.CAP06`, `CAP07` and `CAP08`. Headcount, attrition, tenure, ratios and leader totals remain producer values. Structure and talent commands keep their original versions, idempotency keys, admission checks and F01 draft registry.

Projects remain on `domain.page.CAP09/CAP10`, the original `sfReadProjects`, source version map and `sfProjectCommand`. The save/delete/milestone commands, confirmation bindings, owner generation fencing and unknown-outcome behavior remain in their owners. Budget/spent figures are locale-formatted only; no currency or financial calculation is inferred.

Existing English dictionary strings remain unchanged. New keys have English and Brazilian Portuguese values. Existing source enums are translated only for display; command values are unchanged.

## Coverage and limits

CAP08 workbook preview/download bindings are absent from the source contract in this installation. The two routes therefore remain unavailable, with specific explanatory text and disabled actions. No workbook, preview, download or receipt is manufactured.

CAP08's admitted projection includes the opaque leader ID but no leader-name catalog. That exact ID remains visible in talent detail, editor and review. This work does not add a lookup, borrow CAP07 authority, or invent a leader name. CAP07 uses its separately admitted leader catalog for readable names.

Visual and interaction evidence comes from the grouped native Actions runs, using producer-seeded records in isolated installations. No local runtime, build or tests were used.

## Verification status

- Source review: complete for the five areas and their editor/controller seams.
- GitHub persistence readback: performed with each implementation commit.
- Group E2E: final People5 passed both journeys in `design-wave-three-people.spec.ts` in 3.9 minutes. The real fixture and canonical seed produced three browser-confirmed source writes (member, project and milestone), review/revise retention, cancellation without writes, source rereads, localized pages and workbook limitations.
- Four browser-context diagnostics reported no page or console errors. All 58 expected previews were complete, with no skipped previews.
- People4 passed the explicit portfolio select labels, relocated import action and unfilled new-draft copy. People5 passed the final destructive-color change; direct screenshots confirm deletion uses the danger treatment while milestone save remains primary.

## Terminology and automation references

The Portuguese action vocabulary was cross-checked against the maintained [Firefox preferences corpus](https://github.com/mozilla-l10n/firefox-l10n/blob/main/pt-BR/browser/browser/preferences/preferences.ftl) and [VS Code Git corpus](https://github.com/microsoft/vscode-loc/blob/main/i18n/vscode-language-pack-pt-BR/translations/extensions/vscode.git.i18n.json): editar, salvar, excluir, importar and descartar alterações. Headcount is retained as the established product term; CIO is the source acronym. Talent classifications and employment terms remain domain translations for native-speaker review, with their canonical English payloads untouched.

The journey uses role/label locators, explicit DOM contracts and awaited assertions as recommended in the [official Playwright locator documentation](https://github.com/microsoft/playwright/blob/main/docs/src/locators.md). Screenshots and geometry checks run only through Actions. The 320px view measures reflow, not browser zoom.

Creating an unassigned member exposed an existing presentation validation mismatch: the optional leader select visibly defaults to its empty option while the draft may omit the key. Validation now compares an omitted optional select value to its declared empty option; it does not manufacture a leader, value, version or permission.

## First real browser critique

Run [44938725714](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44938725714), job 136950996592, produced actual native CAP06 dark/light/320px, CAP07 dark desktop and CAP09 dark desktop images. The source installation, owner and views were ready; page/console error lists were empty. Both journeys stopped on an ambiguous test locator shared by a named section and its named table scroller. The spec now targets the actual scroller explicitly.

The viewed CAP06 metric band and CAP07 leadership surface show the intended native typography, hairline separation, aligned actions and quiet materials. CAP09 exposed a concrete defect: the shared table allowed status/risk words to break inside narrow chips. Both CAP09/CAP10 now keep these short labels unbroken; CAP09 also omits the empty row-command column because it never supplies row commands. Record opening remains available. People3 later verified this correction, as recorded below.

Integration gates reported by the owner: [44938736472](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44938736472), job 136951027408, passed application types, E2E types, guards and palette parity. These gates are not visual approval.


## Second real browser critique

Run [44939804395](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44939804395), job 136954292594, reached 30 normal captures across 15 distinct business views, plus two failure diagnostics. Themes, languages, widths and lower-panel captures are variants of a business view, not extra screens. The member title update was confirmed by the original producer and reread by the browser. Page and console error lists remained empty.

Direct image review covered CAP09 desktop, CAP07 member editor/review and narrow review actions, CAP07 narrow members, CAP08 desktop/narrow collection, and CAP10 record detail. The CAP09 status/risk correction is visible: In Progress and Medium now remain intact and the unused row-command column is gone. CAP07 shows the intended 760px editor, clear field groups and readable comparison; all three review actions are fully visible at 320px. CAP07/CAP08 narrow ledgers retain record labels and readable action buttons.

The next refinement makes the record-opening action occupy a consistent line beneath each project name. People review now displays the authorized option label (including the known CAP07 leader name) while retaining the untouched canonical value in its draft and command; an explicitly empty value is described as not recorded. A missing source field remains unknown.

The CAP08 status select had an implicit enclosing label whose accessible name also absorbed option text; the control now has a separate, explicit label association.

The integration owner's source audit identified the CAP10 edit blocker precisely: the UI parser expected a nested { version } object, while the canonical A01 SfDomainVersionNumbers contract and original projectSfDomainVersions projection provide the CAS integer directly. New project was correctly admitted in the frame; an earlier diagnostic incorrectly inferred its absence from the inner content marker. Only existing-record commands were withheld because their parsed version was missing.

The consumer now preserves a safe, nonnegative integer verbatim, including legitimate zero. Missing, string, nested, fractional, negative or unsafe values remain unavailable for editing. Grants, producers, operation availability and command bindings are unchanged. The targeted model regression covers exact CAS preservation, legitimate zero and absence/malformed fail-closed behavior; People3–People5 proved the real project and milestone writes and source rereads. The temporary context diagnostic is removed now that the concrete cause is established.

The five existing Portuguese import strings in the CAP10 catalog have also been completed without altering their English values.

The CAP10 collection screenshot also revealed broken Budget, Spent and Progress header words. The local table now reserves 128px for each amount and 160px for progress, keeps sortable labels and numeric values intact, and retains the existing bounded horizontal scroller. People3–People5 captured the resulting desktop/BR/narrow geometry with admitted row actions present.

The same explicit label association is applied to portfolio Status/Show filters and project/milestone enum selects. The portfolio journey checks those exact accessible names and exercises the canonical Planning filter before resetting it.

The project import action is aligned with the collection introduction to remove the isolated secondary-action strip. New project remains the frame's primary action, and the import action retains its exact admission, busy/uncertain and dirty-draft guards.

New-member review now describes an untouched optional draft field as not specified, using existing localized copy. Persisted source fields that were not supplied remain unknown, and the actual draft/command still omits the untouched key.


## Complete browser evidence

[People3, run 44941257487](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44941257487), job 136958763270, passed both journeys with the production bundle: **2 passed, 0 failed, 3.9 minutes**. The source snapshot was `0b9ec3562cb1e0149a75cb29ab158c782c5d9d96`. The source CAS fix enabled the existing-record controls without changing admission; real project and milestone writes were accepted and reread. All four browser-context diagnostics had empty page-error and console-error arrays.

Direct critique of the newly reached CAP08/CAP10 images confirms the bounded editors and reviews, intact CAP10 sortable headers and number columns, visible edit controls, explicit workbook limitations in both languages, record-specific milestone review, and complete Portuguese review actions at 320px. CAP10's new-project review has only the proposed-record column. A filtered Terminated talent view uses the real source member; it remains a collection variant.

[Gate5, run 44941315850](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44941315850), job 136958928115, passed five checks: application types, E2E types, guardrails, generated-palette byte parity and the targeted portfolio CAS regression. The three CAS cases passed, 78 guard rules found no errors/approval requirements, and the 13 existing test-timeout warnings remained. No local runtime or test was used.

[People4, run 44941868810](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44941868810), job 136960621153, passed **2 journeys, 0 failures, 4.0 minutes**, again with exactly 58 complete captures and four clean browser-context diagnostics. Snapshot `7063cb044b5cfae9469f7ab46ec165cfa1a17eb1` includes the explicit portfolio labels, Planning filter assertions, relocated import action and unfilled new-member copy. Direct inspection confirms the corrected CAP10 collection rhythm and the new-member review's Not specified values.

The final destructive-action audit found CAP10 confirmation shared the primary save color. Project/milestone deletion confirmation now uses the existing Orchestra danger token on the neutral native button, matching the already-correct CAP07/CAP08 treatment. Save confirmation remains primary. Labels, binding, disabled states and command flow are unchanged.

[People5, run 44942301625](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44942301625), job 136961962626, passed **2 journeys, 0 failures, 3.9 minutes**, with exactly 58 complete previews, no skipped/missing/incomplete images, and four clean browser-context diagnostics. The final snapshot is `579e1d4bd85221d0dd2a527f8f09a3ceb37e1408`. Direct final inspection of `CAP10-dark-desktop-delete-review-test-data` confirms the neutral native button with the Orchestra danger text treatment; `CAP10-dark-desktop-milestone-review-test-data` retains the primary save button. Both show the exact project and intended action. Product changes are closed.

## Confirmed commands and canceled reviews

The two journeys confirm **three browser commands** in their isolated producer-seeded installations. Preparatory seed commands are not counted as browser writes.

| Command | Exact business location | Change | Source confirmation |
| --- | --- | --- | --- |
| `domain.command.CAP07.saveMember` | CAP07 Team Structure → Design test data · Taylor Chen → member editor → Save member | Title: Senior infrastructure engineer → Design test data · Regional service delivery manager | Editor returns from review; the Members collection shows the new title from the refreshed source. People journey asserts exactly one POST. |
| `domain.command.CAP10.save` | CAP10 Projects → Design test data · Regional delivery programme → `/orchestra/sf-portfolio/projects/:projectRef/edit` → Confirm save | Budget: 240000 → 190000. Description becomes Design test data · Align regional delivery and retain the source record for review. | Acceptance notice, then fresh owner-bound navigation to the collection showing 190,000; BR editor later reads 190000. Portfolio journey asserts exactly one POST at this point. |
| `domain.command.CAP10.save-milestone` | The same project → `/orchestra/sf-portfolio/projects/:projectRef/milestones` → Design test data · Regional discovery signed off → Confirm save | Notes: Design test data · Discovery evidence accepted by the test operator. → Design test data · Regional discovery reviewed with the delivery owner. | Acceptance notice, then fresh owner-bound navigation and reopened milestone editor with the exact updated notes. Portfolio journey asserts exactly two POSTs total. |

The exact confirmation sites are in [member confirmation](https://github.com/gustavomhss/Orchestra-SF/blob/a255f23fd86a083a0295acd0a08f1be3519da7d0/packages/app-shell/e2e/sucafina/design-wave-three-people.spec.ts#L113), [project confirmation](https://github.com/gustavomhss/Orchestra-SF/blob/a255f23fd86a083a0295acd0a08f1be3519da7d0/packages/app-shell/e2e/sucafina/design-wave-three-people.spec.ts#L306) and [milestone confirmation](https://github.com/gustavomhss/Orchestra-SF/blob/a255f23fd86a083a0295acd0a08f1be3519da7d0/packages/app-shell/e2e/sucafina/design-wave-three-people.spec.ts#L337). Opaque references are assigned by the producer and encoded by the existing same-owner navigation helper.

CIO/leader editors, the new-member draft/review, talent assessment/review, leader-deletion review, project-deletion review, new-project draft/review and Portuguese review states do not confirm a write. New drafts/assessment changes are discarded or revised; deletion reviews are canceled. Confirmed writes remain one in People and two in Portfolio. Evidence attachments are `native-wave-three-people-evidence` and `native-wave-three-portfolio-evidence`.

## Business-view inventory and exact captures

This group delivers **five areas**, with **28 distinct business views/states** evidenced by **58 captures**. Theme, locale, viewport, a selected collection filter and a lower scrolled panel are variants; they are not additional screens. The names below are the exact PNG basenames attached by the journey. JPEG previews have the same names.

| Area | Distinct business views/states | Captures |
| --- | ---: | ---: |
| CAP06 | 1 | 5 |
| CAP07 | 10 | 16 |
| CAP08 | 6 | 15 |
| CAP09 | 1 | 5 |
| CAP10 | 10 | 17 |
| **Total** | **28** | **58** |

### State matrix and principal capture

| Area | Business view/state | Principal capture | Variants |
| --- | --- | --- | ---: |
| CAP06 | **overview** — Headcount overview and leader breakdown | `CAP06-dark-desktop-test-data.png` | 4 |
| CAP07 | **structure** — CIO, leaders and member collection | `CAP07-dark-desktop-test-data.png` | 5 |
| CAP07 | **cio-editor** — Existing CIO editor | `CAP07-dark-desktop-cio-editor-test-data.png` | 0 |
| CAP07 | **leader-detail** — Leader detail | `CAP07-dark-desktop-leader-detail-test-data.png` | 0 |
| CAP07 | **leader-editor** — Existing leader editor | `CAP07-dark-desktop-leader-editor-test-data.png` | 0 |
| CAP07 | **member-detail** — Member detail | `CAP07-dark-desktop-member-detail-test-data.png` | 0 |
| CAP07 | **member-editor** — Existing member editor | `CAP07-dark-desktop-member-editor-test-data.png` | 0 |
| CAP07 | **member-review** — Existing member change review | `CAP07-dark-desktop-member-review-test-data.png` | 1 |
| CAP07 | **new-member** — New member editor | `CAP07-dark-desktop-new-member-test-data.png` | 0 |
| CAP07 | **new-member-review** — New member review | `CAP07-dark-desktop-new-member-review-test-data.png` | 0 |
| CAP07 | **leader-delete** — Leader deletion review | `CAP07-dark-desktop-delete-review-test-data.png` | 0 |
| CAP08 | **talent** — Talent collection, including Terminated filter | `CAP08-dark-desktop-test-data.png` | 4 |
| CAP08 | **member-detail** — Talent member detail | `CAP08-dark-desktop-member-detail-test-data.png` | 0 |
| CAP08 | **assessment-editor** — Existing assessment editor | `CAP08-dark-desktop-assessment-editor-test-data.png` | 1 |
| CAP08 | **assessment-review** — Assessment change review | `CAP08-dark-desktop-assessment-review-test-data.png` | 2 |
| CAP08 | **import-unavailable** — Workbook import unavailable | `CAP08-dark-desktop-import-unavailable-test-data.png` | 1 |
| CAP08 | **export-unavailable** — Workbook export unavailable | `CAP08-dark-desktop-export-unavailable-test-data.png` | 1 |
| CAP09 | **overview** — Portfolio overview, projects and milestone schedule | `CAP09-dark-desktop-test-data.png` | 4 |
| CAP10 | **projects** — Project collection | `CAP10-dark-desktop-test-data.png` | 3 |
| CAP10 | **project-detail** — Existing project detail | `CAP10-dark-desktop-project-detail-test-data.png` | 0 |
| CAP10 | **project-editor** — Existing project editor | `CAP10-dark-desktop-project-editor-test-data.png` | 1 |
| CAP10 | **project-review** — Existing project change review | `CAP10-dark-desktop-project-review-test-data.png` | 3 |
| CAP10 | **milestones** — Project milestone collection | `CAP10-dark-desktop-milestones-test-data.png` | 0 |
| CAP10 | **milestone-editor** — Existing milestone editor | `CAP10-dark-desktop-milestone-editor-test-data.png` | 0 |
| CAP10 | **milestone-review** — Milestone change review | `CAP10-dark-desktop-milestone-review-test-data.png` | 0 |
| CAP10 | **project-delete** — Project deletion review | `CAP10-dark-desktop-delete-review-test-data.png` | 0 |
| CAP10 | **new-project** — New project editor | `CAP10-dark-desktop-new-project-test-data.png` | 0 |
| CAP10 | **new-project-review** — New project review | `CAP10-dark-desktop-new-project-review-test-data.png` | 0 |

### Exact variant names

**CAP06 / overview**

- `CAP06-light-desktop-test-data.png`
- `CAP06-light-320-test-data.png`
- `CAP06-light-320-leaders-test-data.png`
- `CAP06-pt-BR-dark-desktop-test-data.png`

**CAP07 / structure**

- `CAP07-dark-desktop-members-test-data.png`
- `CAP07-light-desktop-test-data.png`
- `CAP07-light-320-test-data.png`
- `CAP07-light-320-members-test-data.png`
- `CAP07-pt-BR-dark-desktop-test-data.png`

**CAP07 / member-review**

- `CAP07-dark-320-member-review-actions-test-data.png`

**CAP08 / talent**

- `CAP08-light-desktop-test-data.png`
- `CAP08-light-320-test-data.png`
- `CAP08-dark-desktop-terminated-filter-test-data.png`
- `CAP08-pt-BR-dark-desktop-test-data.png`

**CAP08 / assessment-editor**

- `CAP08-pt-BR-dark-desktop-assessment-editor-test-data.png`

**CAP08 / assessment-review**

- `CAP08-dark-320-assessment-review-actions-test-data.png`
- `CAP08-pt-BR-dark-desktop-assessment-review-test-data.png`

**CAP08 / import-unavailable**

- `CAP08-pt-BR-dark-desktop-import-unavailable-test-data.png`

**CAP08 / export-unavailable**

- `CAP08-pt-BR-dark-desktop-export-unavailable-test-data.png`

**CAP09 / overview**

- `CAP09-dark-desktop-milestones-test-data.png`
- `CAP09-light-desktop-test-data.png`
- `CAP09-light-320-test-data.png`
- `CAP09-pt-BR-dark-desktop-test-data.png`

**CAP10 / projects**

- `CAP10-light-desktop-test-data.png`
- `CAP10-light-320-test-data.png`
- `CAP10-pt-BR-dark-desktop-test-data.png`

**CAP10 / project-editor**

- `CAP10-pt-BR-dark-desktop-project-editor-test-data.png`

**CAP10 / project-review**

- `CAP10-dark-320-project-review-actions-test-data.png`
- `CAP10-pt-BR-dark-desktop-project-review-test-data.png`
- `CAP10-pt-BR-dark-320-project-review-actions-test-data.png`

### Deliberate evidence limits

The journeys do not claim a separate captured state for new leader, new talent member, new milestone or milestone deletion; those reuse the implemented owned editors/command surfaces. Confirmed destructive writes are not performed. Deletion reviews are opened and canceled with write counts unchanged. Talent import/export are unavailable states, not successful transfer journeys. The 320px checks measure responsive reflow and complete action visibility, not an actual 200% browser-zoom setting. The 192 existing English strings remain unchanged (51 in sf-u03, 41 in sf-u47, 100 in sf-u05), and BR field/action labels are visible in the recorded captures.
