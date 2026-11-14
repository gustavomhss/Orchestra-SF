# WP00 baseline: preservation and permitted semantic changes

The reference is `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`; the approved plan is `dbf9547211d9b0fade619790de7c19c0869b7c7d`. `baseline-capabilities.json` carries the 28 original capabilities, commands, role checks, formats, source blobs and planned destinations. `baseline-new-capabilities.json` maps all 41 requirements and 18 AI capabilities to their approved task owners. These mappings describe scope; they do not claim that a destination already works.

## What is preserved

The Dashboard has 16 entries, Planner seven and Procurement five. Talent Review, Stakeholder Management, IT Performance Contract, Suppliers, Settings, FX rates and Entities & allocations remain explicit entries in the baseline. The `nav.ts` arrays at lines 3–44 and `index.ts` registry reconciliation at lines 12–32 are the observed source for those entries. The scoped CI test compares this inventory to the current navigation and composed domain registries, so a silently removed or orphaned page fails.

Each baseline row preserves its existing commands and write effects, not merely its label. Reorganization into contextual UI does not authorize removal of an import/export format, role guard, field, approval transition or domain command. A page may be read-only: the baseline explicitly records Headcount Overview's lack of a page-specific command, rather than inventing one to make the inventory uniform.

## Permitted semantic corrections and their limits

| Topic | Required behavior | Basis and owner |
| --- | --- | --- |
| Forecast | Closed actual plus open forecast; replace the already included November license once. Keep budget as a separate comparison. | Plan FX01/FX03; WP03.T01–T05. |
| Absence and provenance | Keep blank, zero, inherited, unavailable and restricted states distinguishable according to the domain's existing rules. Do not apply a global zero policy to legacy fields. | C01/C02 and WP03.T02. `effectiveMonthlyBudget`'s legacy annual fallback remains a separately named corpus case. |
| FX and scoring | Preserve the submitted FX snapshot; EUR 28000 at 1.08 is USD 30240. Exclude technically ineligible C from the price pool and ranking. Lowest eligible price does not imply highest score. | Plan FX02; WP04.T03. `form.ts` evaluates eligibility before price normalization. |
| Approval and issuance | A return and a resubmission are distinct events; issuing an internal PO is not realized spend or supplier delivery. | C03 and WP04.T04–T05. |
| Reports | Preserve the selected 20-record diagnostic corpus and the 25-record J05 journey; any chosen summary must name its scope. Preserve comments and record identity. | WP00.T03.CHK.03 and WP07.T04. |
| Confirmation | An unrelated February change does not revoke a January confirmation; material changes, revocation and incarnation replacement require current revalidation. | C06; product-acceptance.md §1; WP08.T03. |
| Cost coverage | Detect an omitted required category; do not treat a reconciled subtotal as fully covered cost. A confirmed zero differs from missing evidence. | C10; product-acceptance.md §2; WP03/WP11/WP13. |

These are approved semantics, not an assertion that every historical implementation is defective. A defect requires a failing consumer proof against the relevant source. New tests exercise existing product functions; they do not introduce replacement calculators or change financial policy.

## Excluded changes

This WP does not change approval levels, holders, thresholds, accounting classifications, authorization policy, rate-allocation semantics, identities or credentials. It does not add SAP/Fabric access, modify Maestro/Relay/Schedule engines, restart a host, deploy Azure, or change desktop/server infrastructure. The host-context/runtime versions retained by the seed remain authoritative; old saved versions must not overwrite them. Import/document UI is owned by WP06. Existing protocol/schema generation uses its official generator if its public seam changes.

## Evidence levels and remaining gaps

`baseline-capabilities.json` is pinned static evidence; the baseline registry and consumer checks are scoped CI evidence only after a recorded passing run. The baseline itself was not executed in this environment. `oracles/journeys-j01-j08.json` is a reproducible journey specification, not a list of completed journeys. The volume recipe defines 1000 financial rows, 200 orders and 100 projects, all synthetic.

No browser observation, visual latency or 30-run measurement is claimed by these fixtures. J01–J08, 320/768/1440 px, zoom 200%, reader authorization after reload and native routine execution retain their required independent proofs. `oracles/measurement-protocol.md` states the exact missing observations and recording format. A passing domain check cannot close those gates.
