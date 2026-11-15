# Mission52 — conditional P6 factual projection proposal

## Status

PROPOSED / NOT_APPLIED / NOT_RUN. Complete source preimages and postimages are in `m52-work/p6-projection-material.json`; the complete three-path patch is `m52-work/p6-projection-complete.patch`. No repository source, remote ref, test, workflow or policy was changed. This is an owner-review proposal, conditional on root's diagnostic08 attribution and selection.

The base is production W06 `78f2362bd09fcbf606505d7833860f1af07b8e6f` over C27 `b10c424a6b318879fc30f11d03ba1cfeffda7d1a`. Neither temporary D7 nor D8 instrumentation is present in these preimages/postimages. The patch does not claim a measured speedup or an installed PASS.

## Intended contract

Stored scenario replay currently calls the complete public `compareForecast` operation with the same source twice and then consumes only `FinancialAnalysis.baseline`. That public operation also reads and validates baseline Forecast cost coverage and derives a financial comparison, which stored replay discards. P6 introduces an optional private capability that returns only the authorized factual Planner projection. It is not an equivalent implementation of the complete public Forecast operation, and it is not exposed on `PlannerPort` or the HTTP surface.

The capability uses the existing real `createSfPlannerEvidence`, which already obtains the actor-filtered source with `projectPlannerSource` and calls `buildPlannerFinancialProjection`. Both are the same projector/builder imported by the public Forecast implementation. Its two authenticated Planner snapshot observations and its source observation before/after projection remain.

The actual case coverage is still selected from the current case and checked by the canonical scenario comparator in all original phases. This proposal removes no case coverage, source freshness, criterion, result reread or complete-case guard. It does not turn unknown costs into zero or conditioned comparisons into complete results.

## Three-path implementation

1. `product/planner/stored-scenarios.ts`: add optional private `projectForecast` with a cloned Planner record source, current trusted context, cloned period and USD selection. Use it only when present and the stored currency is USD. Preserve the original `compareForecast` call when absent or for non-USD input, including its refusal of unsupported currency. A failure from the supplied capability propagates; it never triggers a permissive fallback. Capture the capability identity and deny if it changes before return.
2. `apps/cli/src/sucafina-product/planner-evidence.ts`: retain the real source/snapshot producer while adding explicit canonical evidence digest, installation/project, versionId/recordId and duplicate projection-value-ID checks. Clone reference/selection, bind Request/context/producer identities, validate the selected/reference periods and recheck these observations at egress. The prior whole-month, same-year and USD requirements remain.
3. `apps/cli/src/sucafina-product/business-services.ts`: supply a delayed closure invoking the real projector. The factory retains the callback; the projector is initialized before any read invokes it. The explicit Promise/DomainProjection return annotation avoids depending on circular inference through product.sources.

`product/planner/product.ts`, blob `d3d616e972a73748e6ccac95e3aa7aafdfd204c8`, already types storedScenarios as Omit of the stored-host parameters and spreads it into the constructor. It requires no fourth path or new public port method.

## Preserved behavior and static checks

- The external Procurement branch is byte-for-byte identical to its preimage. Standalone/composite financial semantics, policies, C12 and CurrentChoice are untouched.
- From the stored-host `checked` phase through final result/case rereads and return, the original suffix is byte-for-byte identical.
- The exact original Forecast call remains once, in the fallback, with the same base/candidate source, period, currency and trusted context.
- Canonical historical batch/store method identity is unchanged. No cache or retained authorization is added, and every later comparison phase invokes fresh projection reads.
- Public Forecast, its baseline coverage semantics, and all three source/case-coverage phases in scenario-comparison-port.ts are unchanged.
- Every material preimage's Git blob hash matches the MCP-read source. Postimage hashes and the complete patch are generated from the exact included content. No compiler or product was run.

## Review and qualification boundaries

The new private path intentionally depends on independent source authorization plus the separately enforced current case coverage. It must be assessed as that contract, not justified by saying full Forecast coverage is redundant for every caller. The stronger canonical/duplicate guards also affect the existing Planner evidence users; they preserve the factual proof requirements but need qualification with the real composed UI.

Source and output copies remain isolated. A source failure, stale reference, wrong project/installation, mismatched version, changed Request/binding/reader, invalid period, non-USD request or duplicate projection IDs cannot be converted into a positive projection. Unsupported non-USD calls retain the public Forecast rejection instead of being silently coerced.

Root must review diagnostic08's measured internal stages before choosing this candidate, obtain independent source/authority review, and qualify any selected correction on the exact isolated W with D7/D8 removed. Original five identities, assertions, UI actions and budgets remain unchanged. Passing a static review would not grant integration, financial approval or terminal acceptance.

## Material hashes

Material SHA256: `c2c40160e7d60719b4835e8147dba68c52499d932a905daea35873a6613a907b`.

Patch SHA256: `0ae7112346c28d0cf8511e36836885677a4e2806df536a6e497e63bd0bcf602c`.

- `modules/sucafina/Sucafinav1/product/planner/stored-scenarios.ts`: `529e29806b3faf15f88eec009c198e783f4248a3` → `1761a5d2558c9091d1c02730774751ace44e9131`; postimage SHA256 `61770800dff8bd4dcf64e2a34557ad9468226584640e92072fe786f1a55786ac`.
- `apps/cli/src/sucafina-product/planner-evidence.ts`: `13153182e357b716a12d2554654905d54fa30ee4` → `901434818ad8d029eb8ff1637ce5bb2dc8517205`; postimage SHA256 `d1a4e5db3d2bd1064aa8c618a6f53729759c4178618e9bfce9820ccbd9531dd2`.
- `apps/cli/src/sucafina-product/business-services.ts`: `0181267b67b74a8df338999ddb7745cfee42bb29` → `844edd2860e11d5de165c09c7863f4cc6ef5ad67`; postimage SHA256 `ecda99355b371a295e6d0befacbd5c9f2fe3fc75d2e0062dc143f9b4a04ef1fd`.
