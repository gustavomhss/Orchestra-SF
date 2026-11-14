# WP10 UI reconciliation builder handoff

Builder closed; no local tests, typechecks, builds, server or browser execution. This is construction, not independent review.

## Integration

- `createSfPersonalViewAuthority({ authority })` replaces the old host authorizeView callback (root already wired). It uses canonical page filter vocabulary, exact allowed values and actual actor-filtered Dashboard/Planner/Procurement views; validates version, owner, request and supplier identities; verifies the same projected snapshot twice and revalidates the actor.
- extended-business-services now accepts optional procurementEvidenceWrites and forwards to portfolio services; calls portfolioServices.dispose(). Root period/navigation changes preserved.
- New read routes via existing extended HTTP mount: `sf=bi-options`, `sf=review-update`, `sf=review-source`. `bi-data` accepts explicit baseRef/candidateRef/currency instead of selectionRef (mutually exclusive). All choices are reauthorized; no latest version/result selection.
- BI options cover Planner BI01/02/03/04, exact authorized Procurement collections BI05/06, Dashboard BI01/07/08 and persisted C08 comparison/scenario/sensitivity/portfolio tuples BI09/10/11. Producer-only pairs are constructed from real stored relations, individually authorized; each BI candidate uses a separate exact admission to respect the producer call-selection fence.
- Decision read dispatch enters business.withCase using current participant-authorized case identity derived from stored result, never a browser-supplied authority object.
- BI source links re-read projection and selected value, then resolve the actual evidence before deriving links. No caller-provided URL. Review source links prove evidence membership in the authorized preserved review or its predecessor.
- Reviews compare actual current scoped source versions. The successor preserves previousReviewRef, Dashboard topic IDs/order/periods/notes and source page. Because C04 does not store the original agenda recordRefs, UI requires explicit confirmation of a fresh authorized record set, then allows removing records before preservation. Unknown chart/outcome/thread selections require explicit exclusion rather than silently replacing them. No automatic source expansion is represented as preserved selection.
- openReview preserves page/start/end; openReviewSection authorizes the exact section and renders it in an owned detail panel alongside the published meeting.
- CI own fixes: catalog-narrowed BiViewId in analysis-choice-http, removed unsupported Bun.build write option.

## Regression artifacts

- `test/product/wp10/integration/extended-ui-regressions.test.ts`: real composed C08 review lifecycle with a non-Budget OPEX source edit, immutable prior read, successor link/notes/period, explicit new selection, current revocation; closed saved-view filter grammar and actual host revocation; BI choices read/query refusal.
- `packages/app-shell/e2e/sucafina/wp10/extended-flows.ts`: parent has mounted qualifyWp10ExtendedUi into the existing real installation spec. Covers explicit Planner and Procurement BI picks; preserves OPEX review; edits Annual budget through the existing real OPEX form; verifies domain persistence after reload; reopens exact prior review; discovers update through Check for updates; follows Create an updated review; confirms new selection; preserves and verifies successor/source section. Produces screenshots and sanitized facts.

## Exact constraints / owner deltas

- PreservedReview (C04/WP07) has no original ReviewAgendaItem/recordRefs. Current Dashboard source selection is explicitly chosen again by the human; mixed chart/outcome/thread/other-domain agenda reconstruction remains unavailable without new selection from its owning producer. No atomic agenda sidecar was introduced and no implicit 'all current' reconstruction claimed.
- SfPersonalView (WP01) stores logical selected IDs without captured source incarnation. Adapter proves current actor/page/record access, including disappearance/revocation; same-ID delete/recreate cannot be distinguished from an ordinary persisted filter without a producer contract/pin extension.
- WP01 AlternativeDraft consumer omission remains external, unchanged.
- Existing BI producer limitations for missing waterfall/timeline plans remain displayed. Neither native nor global acceptance is claimed.

No files outside the 12-file manifest were edited by this UI builder task. Root owns host wiring, composition.spec invocation, hosted CI and review.
