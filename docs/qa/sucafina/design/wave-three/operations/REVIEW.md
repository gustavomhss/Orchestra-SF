# Wave three — Operations design review

## Verified group outcome

Five native Sucafina areas are complete for this group: CAP11, CAP12, CAP13, CAP15 and CAP16. The final browser evidence contains **25 distinct states, 72 complete normal captures and five real reviewed writes with same-view projection and fresh source readback**. All six journeys passed across the three bounded execution groups below, with zero console or page errors. No preview was skipped. User acceptance remains separate from these verification results.

The persistent [operations evidence gallery](../evidence/operations/README.md) contains the 72 final captures and their source provenance.

## Scope and provenance

Branch `sf-polish-ops` starts at plan commit `24c02f7f366ecea94a8511c88cdaf2bebcb46be6`, directly descended from the approved `dev` snapshot. This group contains five native Sucafina areas: CAP11 Service, CAP12 Security, CAP13 Risks, CAP15 Stakeholders and CAP16 Performance. Legacy screens, the native HuGR shell, transport, schema, grants and source producers are outside the change.

## Presentation decisions

| Area | Overview and detail | Editing and review |
| --- | --- | --- |
| CAP11 | Three exact SLA values with annual source history in a disclosure. Ticket categories and request types become rows with the same three source measures. Application health exposes P1, P2, tickets and notes separately. Settings and monthly replacement remain secondary. | Category/type field groups replace raw pipe-delimited labels. Service level, heatmap, lists and import use the same source commands. The overview is hidden while the editor or review is active. Labels in review identify their exact source fields. |
| CAP12 | Source KPI values and source-assigned risk statuses form one quiet band. Monthly values and annual history are disclosures. Campaign rates use correctly paired definition groups; department rows remain inspectable. Incidents retain their source dates/status/impact. Source actions without a period are explicitly unscoped and available in a separate disclosure. | KPI sections group prevention, patching and SOC fields. Campaign department fields reflow as labeled records. Consequences and department review values are structured instead of raw JSON. Existing save/delete review bindings remain unchanged. |
| CAP13 | One full-width risk register pairs title and description, aligns assessment factors and reveals a complete record detail. Detail groups separate profile, assessment, response/ownership and source references. | Source fields retain their existing inclusion rules. A focused form groups the fields and keeps review as a distinct stage. |
| CAP15 | One full-width relationship ledger groups person, position, company and department, preserving their source values. Influence factors, priority and ownership remain visible. Detail groups separate relationship, assessment and engagement. | Paired metadata and full-width narrative fields keep long values readable. Existing drafts, exact save/delete commands and source version checks are retained. |
| CAP16 | Contract identity precedes commitments and their source weights. Sub-item ledgers open a full detail with objective, target, ownership and quarter values. Owner assignments sit below the commitments. Missing global score is explicit; no client score is calculated. | Contract, item and sub-item editors group commitment, allocation, ownership and quarter fields. The original allocation confirmation remains in review. Source weights retain the scale where 1 is 100%. |

## Geometry and interaction contract

- Every area carries internal `data-sf-wave="three"` and `data-sf-surface` markers for the common native frame. The host/frame implementation belongs to the integration branch.
- Native type tokens: md body, sm secondary copy, lg row headings, xl section headings, 2xl focused titles and 3xl recorded measures.
- Panels use native raised/soft materials, line tokens, 20 px desktop padding and 16 px narrow padding. No replacement palette, blur system or font asset is introduced.
- All visible input/action targets are at least 44 px tall. Long text wraps; action groups reflow.
- CAP13/CAP15 and CAP16 outer view wrappers explicitly pass the host flex sizing and minimum block size to the frame. A long-editor browser assertion checks bounded height and real internal scroll movement.
- Editors and review stages have a 760 px maximum width. The list/overview remains mounted but hidden during editing and review; source draft controllers are not replaced.
- CAP11 ticket and SLA tables retain a 560 px readable minimum, with a 760 px application ledger inside named keyboard-focusable scrollers.
- CAP12 history/department tables retain a 560 px minimum and incidents an 820 px minimum. Campaign department editors use responsive labeled fields rather than a horizontal editing table.
- CAP13/CAP15 ledgers use a 900 px desktop minimum, then become labeled records below a 979 px frame. Field groups become one column below 479 px.
- CAP16 sub-item ledgers use an 860 px desktop minimum, then become labeled records below 979 px. Other source tables retain a 620 px minimum. Sub-item details expose all four quarters without requiring a ten-column ledger.
- All newly introduced catalog keys have explicit English and Brazilian Portuguese copy. Existing English key values remain byte-for-byte unchanged.

## Source and state integrity

The changes preserve owner-bound reads, source adapters, allowed action IDs, versions/CAS, draft scopes, pending/unknown fencing, idempotency and receipt reconciliation. No source values or default calculations are replaced.

CAP11 uses exact category/type/measure keys with types `Incidents` and `Service Requests` and measures `Initial Balance`, `Open`, `Closed`. Transposition does not aggregate values. Application notes are now visible content rather than a hover-only title.

CAP12 `secActions` rows expose no reporting period in the existing DTO. The selected-month selector stays unchanged. The unscoped disclosure renders only the rows already present in that projection and makes no additional read, date inference or assignment to the selected month.

CAP13/CAP15 missing fields and factors remain unavailable rather than becoming zero. Detail and list option labels are localized without changing saved enum values.

CAP16 weights, quarters, scores and ownership remain exact source scalars. The newly navigable sub-item detail uses the existing focus item/sub-item state and the existing edit/delete handlers. The A01 read schema exposes status/statusQ1–4 as `SfDomainScalar`; `performanceSubSave` accepts `text`, not a closed enum. Detail and review therefore retain the source status text. The existing main-status editor options are unchanged.

Loading, empty, filtered-empty, partial, read-only, denied, stale/conflict, failed, saved and outcome-unknown rendering remains owned by the existing surface/controller and shared state components.

## Final validation and evidence

Repository work used GitHub MCP only. The integration owner executed the existing scoped Actions; this worker created no workflow, independent CI, local runtime, shell session or network mock. Four catalog comparisons against plan `24c02f7f366ecea94a8511c88cdaf2bebcb46be6` confirm **239 existing EN values unchanged and 148 new keys with explicit BR copy** (u04 33, u29 75, u30 15, u31 25).

| Group | Run and browser job | Snapshot | Result | Normal captures | Artifact |
| --- | --- | --- | --- | ---: | --- |
| Service + Security EN | [44947197315](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44947197315), job 136976994257 | `2f1eb6a1e32ceec4ca089997eb8d3f150be838d1` | 2 passed, 3.0m | 23 | 14723368990 |
| Risks + Relationships + Performance EN | [44949738285](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44949738285), job 136984804316 | `e158407ead3653bde7078e2b605be22f6c2e7416` | 3 passed, 4.1m | 24 | 14725441289 |
| Portuguese desktop + 390px | [44949742205](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44949742205), job 136984816760 | `8dedf27d08394db4399d4e393183f75b4ce79c79` | 1 passed, 2.6m | 25 | 14725630442 |

Service/security use their final unchanged consumer blobs. Records and BR run against the integrated `8d5a1e9317712fa9be2afd80cc8bc1dead6434cd` patch. The only subsequent product delta removes the inactive temporary CAP16 diagnostic: inverting that removal reconstructs the tested file byte for byte. Both mutation bodies remain identical to the earlier non-diagnostic code (collection commit 3,317 bytes; performance perform 4,927 bytes). The keyed review capture changes only the presentation subtree. The final combined source/type gates remain owned and recorded by integration.

The operations group has six production journeys across three specs: service/security English in `design-wave-three-operations.spec.ts`, risks/relationships/performance English in `design-wave-three-operations-records.spec.ts`, and Portuguese in `design-wave-three-operations-br.spec.ts`. Five independent English installations prevent one area from concealing another's write. Each journey records one POST, verifies the updated same-view projection, then enters the view again through the owner-bound route and reads the persisted value. All source traffic uses the isolated installation origin.

The BR journey reuses the genuine scoped operator cookie, opens each editor and review, confirms all three review actions fit the narrow viewport, and verifies revision retains the draft. It sends **zero commands**. CAP13/CAP15/CAP16 long editors also prove a positive bounded native scroll height, content taller than that height and actual scrollTop movement. The helper was restored into the records split after its omission was caught at runtime; integration also expanded the E2E type gate to include all three specs.

### Five verified browser writes

| Area | Canonical operation | Reviewed change | Evidence after confirmation |
| --- | --- | --- | --- |
| CAP11 | `domain.command.CAP11.save-sla` | Incident SLA 98.4 → 98.6; the other source levels remain 97.2 and 99.7 in review. | Review closes; 98.6 appears in the same overview and after fresh owner-bound entry; exactly one POST. |
| CAP12 | `domain.command.CAP12.save-campaign` | Campaign notes become “Design test data · Reviewed with the regional source owner.” | Review closes; notes appear in the same projection and after fresh entry; exactly one POST. Incident deletion is reviewed and canceled. |
| CAP13 | `domain.command.CAP13.save` | Risk notes become “Design test data · Risk ownership and mitigation reviewed.” | Applied status/search checks pass; review closes; detail and fresh read show the notes; exactly one POST. Deletion is canceled. |
| CAP15 | `domain.command.CAP15.save` | Relationship notes become “Design test data · Engagement plan reviewed with the service owner.” | Draft cancel/revise retains the notes; review closes; detail and fresh read show them; exactly one POST. |
| CAP16 | `domain.command.CAP16.save-sub` | Sub-item notes become “Design test data · Quarterly evidence checked before confirmation.” | Cancel/revise retains notes and score 3; the excess-allocation checkbox stays unchecked; review closes and both same-view detail and fresh read show the notes; exactly one POST. |

Source fixture construction is excluded from this five-write count. Monthly replacement, settings and destructive reviews are inspected without performing destructive source operations.

### Conservative state and capture count

| Area | Distinct states | Primary captures | Variants | Total images |
| --- | ---: | ---: | ---: | ---: |
| CAP11 | 7 | 7 | 9 | 16 |
| CAP12 | 4 | 4 | 12 | 16 |
| CAP13 | 5 | 5 | 8 | 13 |
| CAP15 | 4 | 4 | 7 | 11 |
| CAP16 | 5 | 5 | 11 | 16 |
| **Total** | **25** | **25** | **47** | **72** |

A state is a distinct overview, record detail, editor or review operation. Locale, theme, viewport, filtering, source disclosures, panel scrolling and repeated navigation are capture variants. The 25 states below each have a dedicated primary capture; no unphotographed state is included in the total. This is the verified journey inventory, not an assertion that every possible source command or authorization state was exercised.

| Area | Distinct state | Primary capture name |
| --- | --- | --- |
| CAP11 | Overview | `CAP11-operations-dark-desktop-test-data` |
| CAP11 | Category editor | `CAP11-categories-editor-dark-desktop-test-data` |
| CAP11 | Application heatmap editor | `CAP11-application-editor-dark-desktop-test-data` |
| CAP11 | Monthly replacement editor | `CAP11-import-editor-dark-desktop-test-data` |
| CAP11 | Monthly replacement review | `CAP11-import-review-top-dark-desktop-test-data` |
| CAP11 | SLA editor | `CAP11-sla-editor-dark-desktop-test-data` |
| CAP11 | SLA review | `CAP11-sla-review-dark-desktop-test-data` |
| CAP12 | Overview | `CAP12-operations-dark-desktop-test-data` |
| CAP12 | Incident deletion review | `CAP12-incident-delete-review-top-dark-desktop-test-data` |
| CAP12 | Campaign editor | `CAP12-campaign-editor-dark-desktop-test-data` |
| CAP12 | Campaign review | `CAP12-campaign-review-top-dark-desktop-test-data` |
| CAP13 | Risk register | `CAP13-operations-dark-desktop-test-data` |
| CAP13 | Risk detail | `CAP13-detail-dark-desktop-test-data` |
| CAP13 | Risk deletion review | `CAP13-delete-review-dark-desktop-test-data` |
| CAP13 | Risk editor | `CAP13-editor-dark-desktop-test-data` |
| CAP13 | Risk save review | `CAP13-review-top-dark-desktop-test-data` |
| CAP15 | Relationship register | `CAP15-operations-dark-desktop-test-data` |
| CAP15 | Relationship detail | `CAP15-detail-dark-desktop-test-data` |
| CAP15 | Relationship editor | `CAP15-editor-dark-desktop-test-data` |
| CAP15 | Relationship save review | `CAP15-review-top-dark-desktop-test-data` |
| CAP16 | Performance overview | `CAP16-operations-dark-desktop-test-data` |
| CAP16 | Item editor | `CAP16-item-editor-dark-desktop-test-data` |
| CAP16 | Sub-item detail | `CAP16-subitem-detail-dark-desktop-test-data` |
| CAP16 | Sub-item editor | `CAP16-subitem-editor-dark-desktop-test-data` |
| CAP16 | Sub-item review | `CAP16-subitem-review-top-dark-desktop-test-data` |

### Final visual critique

The final service evidence shows aligned ticket category/type/measure columns, exact zero values and explicit application absences. Monthly replacement Original/Current compare the real admitted month, and the review footer is reachable through the native scroll region. Security KPIs align as 4×2 on desktop and 2 columns at 390px; campaign rates are concise while their exact source values remain disclosed. Campaign departments, incident deletion identity, explicit proposed deletion and action footers remain legible.

Peer review covered CAP13/CAP15 BR overview, detail, editor and review. Its one Priority word-break finding was corrected and re-inspected in the final BR desktop/390px captures: “acompanhamento” remains whole and neighboring columns still fit. The final English risk/relationship review headings correctly identify Edit. Typed option labels translate in presentation while source values remain unchanged.

CAP16 final desktop sub-item editor, review top/footer and lower owner/quarter panels were directly inspected. Source weight 0.6, score 3, target 98%, ownership and quarter values remain readable. The unchanged allocation confirmation appears at the review top; all three actions fit the footer. BR quarter fields stay paired in reading order and actions stack without cuts. Source status strings on/ahead remain raw because the contract accepts text rather than an enum.

### Scope and evidence limits

- Actual browser zoom at 200% was not measured. The 390px viewport and bounded native scroll/reflow assertions are the narrow-layout evidence.
- The five listed save operations are qualified by real writes and fresh reads. Other CRUD paths retain their source contracts and presentation, but no full command-matrix qualification is claimed.
- Genuine lost responses, owner revocation, denied access and concurrent CAS conflicts were not fabricated. Their existing controllers/fences remain; the presentation failures documented below are distinct from a validated network-loss scenario.
- CAP13 route.query.filter risk-tier deep links retain their existing path and were not qualified or given new support. Visible search/status and applicable owner selection use only already authorized records.
- CAP12 management actions without a source reporting period remain explicitly unscoped. CAP16 has no producer global score; the UI explains that absence and does not calculate one.
- Ops6's completed log could not be retrieved through the connector. Its exact failure count/cause remains unproven; later bounded executions diagnose their own observed failures.
- Canonical PNGs and source evidence are in the listed Actions artifacts; bounded JPEG previews support direct visual critique. Integration owns the persistent gallery and final combined gates. No user approval or merge is inferred from green tests.

### Capture variants

The following 47 names complete the 72-image manifest together with the 25 primary names above.

### CAP11 capture variants

- `CAP11-operations-light-desktop-test-data`
- `CAP11-ticket-ledger-dark-desktop-test-data`
- `CAP11-application-health-dark-desktop-test-data`
- `CAP11-settings-dark-desktop-test-data`
- `CAP11-import-review-dark-desktop-test-data`
- `CAP11-operations-pt-BR-dark-desktop-test-data`
- `CAP11-operations-pt-BR-dark-390-test-data`
- `CAP11-editor-pt-BR-dark-390-test-data`
- `CAP11-review-pt-BR-dark-390-test-data`

### CAP12 capture variants

- `CAP12-operations-light-desktop-test-data`
- `CAP12-campaign-departments-dark-desktop-test-data`
- `CAP12-incidents-dark-desktop-test-data`
- `CAP12-incident-delete-review-dark-desktop-test-data`
- `CAP12-unscoped-actions-dark-desktop-test-data`
- `CAP12-department-editor-dark-desktop-test-data`
- `CAP12-campaign-review-dark-desktop-test-data`
- `CAP12-operations-pt-BR-dark-desktop-test-data`
- `CAP12-operations-pt-BR-dark-390-test-data`
- `CAP12-editor-pt-BR-dark-390-test-data`
- `CAP12-departments-pt-BR-dark-390-test-data`
- `CAP12-review-pt-BR-dark-390-test-data`

### CAP13 capture variants

- `CAP13-operations-light-desktop-test-data`
- `CAP13-filtered-empty-dark-desktop-test-data`
- `CAP13-review-dark-desktop-test-data`
- `CAP13-operations-pt-BR-dark-desktop-test-data`
- `CAP13-operations-pt-BR-dark-390-test-data`
- `CAP13-detail-pt-BR-dark-390-test-data`
- `CAP13-editor-pt-BR-dark-390-test-data`
- `CAP13-review-pt-BR-dark-390-test-data`

### CAP15 capture variants

- `CAP15-operations-light-desktop-test-data`
- `CAP15-review-dark-desktop-test-data`
- `CAP15-operations-pt-BR-dark-desktop-test-data`
- `CAP15-operations-pt-BR-dark-390-test-data`
- `CAP15-detail-pt-BR-dark-390-test-data`
- `CAP15-editor-pt-BR-dark-390-test-data`
- `CAP15-review-pt-BR-dark-390-test-data`

### CAP16 capture variants

- `CAP16-operations-light-desktop-test-data`
- `CAP16-items-dark-desktop-test-data`
- `CAP16-owner-assignments-dark-desktop-test-data`
- `CAP16-subitem-quarters-dark-desktop-test-data`
- `CAP16-subitem-review-dark-desktop-test-data`
- `CAP16-operations-pt-BR-dark-desktop-test-data`
- `CAP16-operations-pt-BR-dark-390-test-data`
- `CAP16-subitem-detail-pt-BR-dark-390-test-data`
- `CAP16-editor-pt-BR-dark-390-test-data`
- `CAP16-quarter-editor-pt-BR-dark-390-test-data`
- `CAP16-review-pt-BR-dark-390-test-data`

## Earlier evidence and corrective iterations

The sections below preserve the evidence at each earlier stage, including failures and then-pending work. The final validation above records the completed browser result.

## First real browser evidence and corrective pass

The integration run [44938732155](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44938732155), browser job 136951014336, emitted 50 complete JPEG previews plus canonical PNG attachments. Its integration source preceded the outer flex-wrapper correction.

- The Portuguese journey passed for all five desktop/390 px overviews and their detail/editor/review interactions.
- The English journey rendered all five dark/light overviews. CAP11 SLA and CAP12 campaign writes were confirmed through fresh source readback.
- English stopped at CAP13 fresh readback; CAP15/CAP16 English writes had not run. The test used disappearance of the editor as its post-save wait even though CAP13/15/16 already remove that editor on entering review. Navigation could therefore interrupt a pending command. The corrected journey waits for the review to close and the updated projection to appear before fresh navigation. This correction still requires the next integration run; no successful CAP13 write is inferred from the failed run.
- CAP11 ledgers/application notes and focused import layout were visually legible, with exact zero/missing distinctions. No ticket measure was renamed in the underlying source.
- CAP12 needed a balanced four-by-two KPI band. Its original precision exposed a 17-character fractional rate at headline size. The corrected presentation uses locale-aware formatting with at most two decimals and exposes the full original numeric string in an accessible source-rate disclosure. The test checks both 4.17% and the exact 4.166666666666666%.
- CAP13/CAP15 desktop headings and narrow scalar cells broke words (Probability, Perception and monitoring). Scoped word-boundary wrapping and unbroken scalar status/date/factor values correct that defect without truncation.
- The inspected 390 px CAP11 editor and CAP13/CAP15 registers retained readable labels, 44 px controls and contained horizontal geometry.

The corrected state is not yet a final visual PASS. Remaining evidence is the rerun, CAP15/CAP16 English write/readback and final captures of the corrected layouts.

## Second real browser evidence and final corrections

Integration run [44940193534](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44940193534), browser job 136955482163, emitted 41 complete previews. The BR journey passed again with empty console and page-error arrays.

Direct image review confirms the four-by-two security KPI band, the rounded 4.17% campaign display, unbroken Probability/Perception headings and source dates/statuses, and restored bounded frame geometry for the long CAP13/CAP15/CAP16 editors. Their top captures now include the native context, tabs and chapter heading.

The stronger English post-save wait exposed a real CAP11 reconciliation presentation failure: a successful source write was followed by a TypeError during same-view refetch. CAP11/CAP12 previously published page/ready before confirming and releasing the completed draft, briefly remounting review props that read that controller. The corrective source change performs the existing receipt reconciliation while the view is still loading, then publishes the ready page. It does not change the request, owner/per-period fence, confirmation rules or stored values. Both journeys now require empty console-error arrays.

Additional scoped corrections from the real BR captures:

- CAP13/CAP15 review fields use the same known option labels as list/detail/editor; unrecognized text remains raw. Risk status is a closed command enum; stakeholder priority is source text with an existing native option map. No submitted value is localized.
- CAP16 form and review respect the declared quarterly order: value, then status for each quarter. The status strings remain source text. A BR capture targets the quarterly form group.
- The CAP16 English save locator now matches the actual existing review button label, Save.
- All three long BR wrapped editors explicitly assert nonzero bounded client height, content overflow and actual movement inside the native page scroller.

This commit awaits the next integration execution. No additional successful English write or final visual approval is claimed yet.

## Diagnosed editor teardown and independent journeys

Runs [44941155893](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44941155893) and [44942005547](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44942005547) each completed with the BR journey passing and the English journey failing after CAP11 Save. Therefore the ordering change in 2530476 alone did **not** fix the issue.

The bounded, redacted diagnostic in job 136961044738 identified the concrete failure: `TypeError: Cannot read properties of null (reading 'action')` in a reactive consumer computation. The temporary stack logger has been removed. The CAP11 editor subtree now captures its admitted editor identity with a keyed Show; its review captures the active draft snapshot separately. Review snapshot construction receives that editor explicitly, and editor-only page reads use the page captured while that subtree mounted. Equivalent CAP12 code receives the same cleanup fix. Closing the global editor can no longer make those existing reactive props dereference a null editor. Submit handlers still read current owner, admission and pending state at execution.

The English spec is split into three isolated installations to expose failures independently. Its expectations remain strict: the new value must appear in the same mounted view before fresh navigation, the source must return it again, the exact number of commands must match, and console/page errors must be absent. Additional screenshots record already exercised category/heatmap/import/deletion states; they do not add commands.

Run 44941155893 also verified all three long BR editors have bounded native scrolling, localized review labels in CAP13/CAP15 and paired quarter/status form order in CAP16. Run 44942005547 includes the narrow CAP12 KPI label-height correction. Final approval still waits for successful independent English writes.

## Fifth browser execution: service/security writes pass; applied selection corrected

Run [44943089044](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44943089044), browser job 136964366000, completed with three journeys passing and one failing (5.2 minutes), and emitted 52 complete previews including the failure capture. The independent CAP11 and CAP12 journeys passed their real reviewed writes, updated same-view projection, fresh source readback and zero console/page-error checks. The BR journey passed with zero errors. This proves the captured editor/snapshot cleanup fix for those exercised save paths.

The collection journey failed before its first write: after applying status `closed`, the source-backed count returned 2 instead of 0. The strengthened count assertion exposed a real defect that the earlier transient loading-row assertion missed. The native domain projection returns all authorized records; the original q/status/owner selection exists in the legacy renderer rather than the native DTO. CAP13/CAP15 now select only from those already authorized rows inside their read consumers, using the applied query captured for that read. Search uses source text name/title/description fields, trimmed case-insensitive input; status and ownership use exact equality. Versions, actions, source values and producers are unchanged. Draft filter edits still wait for Apply. The spec checks both the unchanged pre-Apply count and the post-Apply result.

The existing route.query.filter path is retained. Risk-tier deep links were not qualified and gained no support in this wave; no tier formula was copied into the native app and no module/runtime dependency was added. The visible panel exposes search and status.

CAP13, CAP15 and CAP16 now have separate English installations, retaining one real write and strict same-view/fresh-read assertions in each. Their successful writes are still pending; no outcome is inferred from CAP11/CAP12 success.

Direct review of the new CAP12 incident deletion image revealed empty source cards and a UUID-only operation identity. Its presentation now includes the already captured incident/campaign/action fields in original/current source, uses the record title/name/text where available, and explains the proposed removal with new EN/BR copy. Original/current source fields use the admitted source row to preserve absence/null as missing, including BooleanStored flags; an unknown flag is not presented as a confirmed No merely because the existing checkbox draft defaults to false. The exact deletion binding, version, draft values and command remain unchanged; the journey cancels deletion. Long reviews also get a top capture in addition to their existing action-footer capture.

## JSON command boundary before the sixth execution

The canonical Finance browser probe established that explicit optional `undefined` values are rejected by the strict JSON codec. Source inspection showed the same complete path here: CAP13 `riskValues` constructs absent ownerId/leaderId as undefined; CAP15 has equivalent optional fields; the shared draft retains those values in a signal, and the collection save previously forwarded them directly. No intervening serialization removes them. This is sufficient evidence to correct the consumer boundary before knowingly repeating that failure.

CAP13/CAP15 now materialize command values with Object.entries/Object.fromEntries, omit only entries whose value is undefined, and omit an absent top-level id for creation. Zero, null, empty strings and other supplied values are retained; unknown supplied string keys still reach canonical schema validation. CAP16's three existing DTO constructors use the same omission rule: a new item/sub-item has no id yet, and untouched absent target/quarter scalars must stay absent. The required parent itemId remains explicit. Existing field conversion, owner/version, confirmation, draft, digest, idempotency and producer behavior are unchanged.

These corrections need the independent runtime writes and final scoped type gates; source inspection alone is not recorded as a successful write.

## Pending and unknown review controls

CAP11/CAP12 Cancel/Revise callbacks now reject transitions while a command is submitting or its outcome is unknown. A local native disabled fieldset makes this restriction visible and keyboard-safe, without changing shared S03. The existing Check outcome action remains available outside that disabled fieldset during outcome-unknown and calls the same scoped refresh; the duplicate internal reconcile button is omitted in that state. Existing fieldset styling already resets its border, padding and width, so the normal review geometry is unchanged. No draft, pending operation, idempotency or command is cleared by closing presentation.

This is a local guard confirmed by source review; the campaign does not simulate lost responses or claim runtime qualification of artificial outcome-unknown states. The normal real writes and final browser captures remain the execution gate. Scope is now frozen except for concrete runtime or gate findings.

## Import comparison found in the sixth runtime capture

The newly captured top of CAP11 monthly replacement review in run [44945528183](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44945528183) exposed a concrete presentation error: Original/Current said No records yet even though the selected month contained ticket, SLA and application records. The draft's new command intent was incorrectly treated as absence of source data.

The presentation now uses the source's existing `ops:year-month` group reference only when that exact version key is present in the admitted page. Original/current use the existing draft baseline/conflict values and their existing month CAS; Proposed retains the new command intent. If the source lacks that comparison key, the review explicitly says the source does not provide a comparison for the selected month. It does not invent a record reference or version. Draft acquisition, digest, command and confirmation remain unchanged.

The CAP11 journey now requires Original and Current source to show Infrastructure Incidents Opened = 12 and Incident SLA = 98.4 before canceling the replacement review. Its existing top/footer capture names remain stable. This minimum correction needs its targeted runtime rerun; the other independent journeys continue unaffected.

## Sixth-run evidence retrieval and bounded execution groups

Run 44945528183 finished with workflow failure and preserved artifact 14723751314. The GitHub connector could read an early 4.2 MB partial log, proving clean CAP11/CAP12 page-close diagnostics and capturing CAP13 through its applied empty filter and review. Repeated attempts to read the completed log returned Transport closed to both integration owner and worker. The alternate annotations endpoint was not permitted by the connector. Neither restriction was bypassed. The final test failure count and cause are not inferred from the workflow status or annotation count.

The same six journeys are therefore split into the three group-owned specs above for independent existing test-ci jobs. Test names, source commands, captures, counts, same-view waits, fresh readback and all prior assertions are preserved. Only short constants and helpers are repeated; no CI/config/helper contract changes are introduced. The BR journey also explicitly asserts the already recorded empty console-error array, matching the English gates. The CAP11 monthly comparison assertions from 75f00a3 remain included.

This split is for accessible evidence and failure diagnosis. It is not a passing rerun and does not remove a failing assertion.

## Existing-record review identity

The Ops6 CAP13 review-top capture also showed the create label New risk above an existing record's original/current comparison. The shared CAP13/CAP15 save review used the primary create label unconditionally. Its presentation now uses the existing Edit label when the admitted draft has an entity, and preserves the area-specific primary label for creation. Record identity, controller and save binding are unchanged. Each corresponding English journey checks the review operation label before saving. This observed presentation defect is recorded separately from the still-unknown cause of the Ops6 workflow failure.

## User guide notes for integration

Service: select year/month, inspect SLA/history and ticket categories, edit the required section, then review. Categories/applications are under their disclosure. Monthly replacement is prepared and reviewed before sending.

Security: select the reference period, inspect producer KPIs, open annual/monthly source details when needed, and manage campaigns or incidents in focused forms. Management actions without a period remain explicitly unscoped.

Risks and relationships: use the register filter, open the record for the full detail, then edit and review. Assessment factors and priority labels retain the same saved values.

Performance: review commitments and their source weights, open a sub-item for ownership and quarterly detail, then edit or add the corresponding item/sub-item. Weights use the original fractional scale; a global score is unavailable unless the source supplies one.

## Bounded verification after the six-journey split (Ops7, in progress)

Service/security run `44947197315` passed both real-write journeys (3.0m), and BR run `44947277075` passed the desktop/390px journey (1.8m); both reported no page or console errors. Their logs yielded 23 and 25 complete normal previews respectively. CAP11 monthly replacement now verifies source values in Original and Current source instead of an empty-month claim.

Records run `44947272207` / job `136977226477` completed with three failures. CAP13 and CAP15 reached Save, then the local `N16 mutation result unknown` catch kept the review unresolved; the current evidence does not identify the throw or establish success. A temporary diagnostic reports only the local phase, error name and stack frames without the message/first line or payload. The existing uncertain-outcome behavior is preserved. CAP16 stopped before Save because the split records spec lacked the `scrollableEditor` helper; its identical existing helper is restored from the BR spec, retaining the bounded-height and real-scroll assertions. The missing helper is a test-split defect, separate from the product mutation failure.

Peer visual review of the final BR CAP13/CAP15 overview, detail, editor and review captures found one presentation defect: CAP15 desktop split the word “acompanhamento” inside the Priority column. A local CSS rule reserves room for the priority value and permits wrapping between words. No other refinement is included. This visual finding is independent of the unresolved records mutation failure. Final records writes, final state mapping and visual completion remain pending.

## Confirmed collection presentation failure and homologous performance correction (Ops8)

Records run `44948459274` / job `136980875441` completed with three failures and 24 complete normal previews. The restored long-editor helper now reaches CAP16 review and Save. CAP13 and CAP15 both report `publish-confirmed Error` with the same Solid renderer stack. This stage is reached only after writeOutcome has admitted an HTTP 2xx response with body.ok true; the synchronous store update that leaves review throws before confirmed-draft tracking and source refresh. No codec mismatch, lost network response or controller reset is inferred as the cause.

The save-review Show for CAP13/CAP15 now uses keyed content and captures the existing draft object for its own subtree. Its previous accessor depended on the mode that the successful result invalidates, allowing review prop evaluation during teardown to throw. Commands, pending controller, version, confirmation tracking and refresh remain unchanged. The temporary collection diagnostic is fully removed.

CAP16 has the same review structure and now exhibits a real exception when leaving the reviewed write. Its corresponding review-edit subtree uses the same keyed capture. No independent CAP16 stack was obtained in Ops8; this is recorded as the correction of a homologous presentation structure, not as a separate proved stack diagnosis. Only CAP16 temporarily retains the same minimal stage/name/stack-frames diagnostic in its existing catch as a contingency if the next execution still fails. It contains no first-line error message, payload or credentials and will be removed after locating the cause or a clean run.

BR run `44948463018` / job `136980887105` passed in 1.9 minutes with 25 complete normal captures and zero console/page errors. The final desktop CAP15 priority capture keeps “acompanhamento” whole, wrapping only between words; the 390px record layout remains intact. Direct inspection of the new CAP16 desktop sub-item editor and review top/footer found complete source values, paired quarters, reachable actions and the original excess-allocation checkbox still unchecked. Final success requires three clean record writes, same-view projection and fresh source readback after this patch; no failing assertion is weakened.

## Final clean execution and diagnostic removal (Ops9)

Records run 44949738285 completed with three passing journeys in 4.1 minutes; all three page-close diagnostics contain empty consoleErrors/pageErrors arrays. The strict write-count, same-view projection and fresh readback assertions pass for CAP13, CAP15 and CAP16. BR run 44949742205 passes its single journey in 2.6 minutes with the same empty diagnostics. The 24 records and 25 BR captures are complete, with no skipped or failed capture in either final group. Together with unchanged service/security evidence, this closes the five writes and the 25-state/72-capture map above.

After the clean execution, only the temporary CAP16 stage variable, its stage assignments and expanded stack logger are removed. The original catch logger and uncertain-outcome behavior remain. Applying the exact inverse of this removal reconstructs the tested performance file byte for byte; no command, condition, controller call, confirmation, refresh, layout, catalog or spec changes accompany it. The final product contains no temporary diagnostic from this investigation. The clean CAP16 write confirms the homologous keyed-capture correction; no earlier independent CAP16 stack is retroactively claimed.
