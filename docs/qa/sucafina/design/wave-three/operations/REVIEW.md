# Wave three — Operations design review

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

CAP16 weights, quarters, scores and ownership remain exact source scalars. The newly navigable sub-item detail uses the existing focus item/sub-item state and the existing edit/delete handlers.

Loading, empty, filtered-empty, partial, read-only, denied, stale/conflict, failed, saved and outcome-unknown rendering remains owned by the existing surface/controller and shared state components.

## Validation status

Product source review is complete for this commit. Catalog inspection confirms unchanged existing English values and explicit BR entries for every new key. Repository work used GitHub MCP only; no local runtime, shell, mock network or independent CI was used.

The integration owner will run the existing scoped Actions gates and the group journey `design-wave-three-operations.spec.ts` against an isolated real native installation. Visual PASS is **not** claimed before actual captures are inspected. User acceptance is separate from code and test success.

### Pending evidence

- Desktop dark/light overview and active editor/review for all five areas.
- BR localization and 390 px reflow, including visible review actions.
- CAP11 settings/import and heatmap editor; CAP12 campaign departments and explicitly unscoped actions.
- CAP13/CAP15 detail, edit and delete review cancellation.
- CAP16 item, sub-item detail, editor and review; preserved draft after review cancellation.
- Real writes, readback, browser errors and the unchanged producer command families.

## User guide notes for integration

Service: select year/month, inspect SLA/history and ticket categories, edit the required section, then review. Categories/applications are under their disclosure. Monthly replacement is prepared and reviewed before sending.

Security: select the reference period, inspect producer KPIs, open annual/monthly source details when needed, and manage campaigns or incidents in focused forms. Management actions without a period remain explicitly unscoped.

Risks and relationships: use the register filter, open the record for the full detail, then edit and review. Assessment factors and priority labels retain the same saved values.

Performance: review commitments and their source weights, open a sub-item for ownership and quarterly detail, then edit or add the corresponding item/sub-item. Weights use the original fractional scale; a global score is unavailable unless the source supplies one.
