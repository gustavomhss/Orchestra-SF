# Procurement wave-four handoff

## Delivered and observed

CAP24–CAP28 are implemented in the native Orchestra app. Procurement code through `7c2ddfad2dddf00709c04a3f554e8050ba9ea773` is integrated by the root. [Procurement10](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965165654) tested product `331cafc50bee2112f6366ff428658de938c6f58e` through snapshot `7f3de0206fc25b2925d7c55947d9b5785bdfe7ba` and passed all four installed browser journeys, eleven original producer POSTs and eleven explicit fresh canonical readbacks. Page and console error arrays were empty.

The [gallery](../evidence/procurement/README.md) contains all 43 manually reviewed JPEG previews and a machine-readable manifest with provenance, Git blob SHAs, dimensions and command outcomes. No blocking visual defect was observed in those captured states. The gallery preserves the latest passing run; earlier failures and partial passes remain in [evidence-plan.md](evidence-plan.md).

Six acknowledgement bodies were readable and positive. Five were unavailable to the collector, with only error class `Error` recorded and no established cause. The latter still required HTTP 200, JSON content type, the original application's completed review, provider/view readiness, one POST and an exact fresh source readback. Readable negative or malformed acknowledgements always fail. The report does not claim eleven readable acknowledgement bodies.

## Implementation paths

| Ownership | Repository paths |
| --- | --- |
| Native leaves | `packages/app-shell/src/orchestra/chapters/sucafina/procurement/{overview,requests,queues,sourcing,approvals/pr,approvals/remaining,suppliers,settings}/` |
| Command input boundary | `packages/app-shell/src/orchestra/chapters/sucafina/procurement/command-snapshot.ts` and `number-input.ts`; leaf controls and payload mapping |
| Localization | Existing leaf `copy.ts` files and `packages/app-shell/src/i18n/orchestra-chapters/sf-u12.ts`, `sf-u13.ts`, `sf-u14.ts`, `sf-u36.ts` |
| Original-producer seed | `packages/app-shell/e2e/sucafina/design-support/wave-four-procurement-data.ts` and `wave-four-procurement-seed.ts` |
| Browser journey | `packages/app-shell/e2e/sucafina/design-wave-four-procurement.spec.ts` |
| Focused regressions | `packages/app-shell/test-browser/sucafina-procurement-command.test.ts` |
| Evidence | `docs/qa/sucafina/design/wave-four/evidence/procurement/` |

The root owns shared frame/navigation, host service composition, installation fixture and CI integration. No procurement producer, schema, role/grant adapter, guard, allowlist or workflow is altered by this leaf. No individual PR or merge was performed by this leaf.

## Decisions that matter

The five areas use the native frame and tokens, with deliberate list/detail/editor/review transitions. Lists are one ledger, editors are bounded to 760–900 px and reviews to 760 px; controls have 44 px targets. Local return to a list preserves the existing draft, and review cancellation resumes it. Reviews show source and proposed values without competing with the browsing surface. Busy Cancel/Revise controls follow only the checking, submitting and verifying phases.

Original F01 references use `encodeSfRouteRef`; source comparison links use the existing `/sourcing/compare` route. CAP26 sourcing/PO decisions use the host's existing `/approvals/:requestRef/review` dispatch. Approval preflight and retained revalidation request the native allowed queue selection and locate the exact reference through the original model. A failed source read is not mislabeled as a version conflict; explicit stale or mismatched revisions still follow conflict handling.

PR/PO and sourcing command snapshots are plain captured DTOs before the digest and dispatch. They retain values, order, null/zero, metadata and enumerable excess properties for the original decoder. Numeric controls convert finite user input to numbers, empty numeric input to null and keep invalid text visible to validation. The original producer and F02 codec remain authoritative.

Settings source delivery calls the original draft controller under `untrack`, preventing the source effect from subscribing to its own publication. The effect still tracks the genuine projection and controller. The regression proves initial delivery once, no redelivery on local edit, and a changed-source-version conflict with the local value retained. It uses the real Solid browser runtime and original controller.

The selected quotation, description and notes remain in the sourcing save/review/readback; order line notes survive an unrelated delivery-condition edit. Missing financial values remain distinct from a recorded zero. Owner stamps, source revisions, CAS, idempotency, pending/unknown recovery and truthful receipt handling remain original. The copy audit records 405 audited keys, zero changed original English values and no missing pt-BR entries in those dictionaries.

## Test evidence and limits

The browser spec runs four independent genuine installations: requests/sourcing/approvals (eight writes), suppliers (two), settings (one) and localized source entry views (zero). Each confirmation has an exact one-POST assertion and fresh source readback; each group has an exact total. The actions use the existing 15-second default timeout. Real producer seed commands and original local-operator enrollment supply the data and admin/buyer roles; authentication, grants, source records and receipts are not mocked.

[Gate 44964454946](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44964454946) passed 12 gates and 84 regression cases, including ten procurement browser-condition cases. The focused command regression is run from `packages/app-shell` with `bun test --conditions=browser --preload ./happydom.ts ./test-browser/sucafina-procurement-command.test.ts`. These are observed Actions results; no local build, test or browser was run by this leaf.

The final capture set contains 29 desktop images at 1440 × 1100 and 14 narrow images at 320 × 900. English command journeys, dark/light samples and Portuguese entry views for all five areas were inspected. The dense native tables retain internal horizontal scrolling. Existing empty Actions columns and the order heading/fieldset repetition are nonblocking visual observations. The route inventory contains 17 existing patterns; this is not full route/state/theme coverage or a browser-zoom measurement.

The positive journey does not write supplier bank details, activate suppliers, reset policies, dispatch external notifications, assert external order delivery or inject network failures. Existing negative-role, pending/unknown and secret-protection regressions remain separate. The coordinator owns the latest whole-product gate and the final integration/merge decision.
