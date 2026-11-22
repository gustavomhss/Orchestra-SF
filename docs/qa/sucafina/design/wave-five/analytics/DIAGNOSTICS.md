# Focused analytics diagnostics

These hosted runs narrow concrete failures. They do not replace the two complete installed UI journeys, approve screenshots or manufacture a successful source. Every run used the existing test-ci workflow and strict omni control with the production channel; no workflow was edited.

## Native portfolio input boundary

The original closed schema and wire codec worked on a pristine structural input, but the same values failed after the actual browser build of Solid exposed them through a store. The first successful reproduction ran two cases and failed both; the plain-input observation occurred before proxy access, while the later raw/wire checks occurred after access. The corrected regression explicitly records that both the proxy and its retained raw object fail the unchanged full decoder after proxy access. Unwrapping alone is insufficient.

The adapter now unwraps and structurally clones the native values before applying that same original closed decoder. It does not select an allowed subset of fields. The boundary retains extra root, case-identity, scope, period and operation string fields, including an extra field whose value is undefined, so the original decoder still rejects them. It also rejects missing identity/period fields, an empty case reference, invalid version/candidate values, nonfinite amounts, malformed sensitivity references/bounds and non-cloneable inputs. Source authorization and relationship validity remain with the actual producer; these pure structural checks do not claim to validate an arbitrary case/scenario relationship.

Only the seven native portfolio input calls use the helper. Their operation identities, readiness checks, output validation, idempotency and source bodies remain intact. The permanent regression lives under test-browser so it uses Solid's actual browser proxy; placing it in the ordinary server-conditioned unit directory would test a different runtime.

| Run | Snapshot / source | Result and limit |
| --- | --- | --- |
| [44985680214](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44985680214), job `137095599457` | `a301c8d7ffa5bba7574b687bd32f867bacdcf828` / `a96a9fbac7710c3e30a9b3ebda95fd7dc139f3c3` | Failed before tests: request argument splitting detached the value of --preload. No decoder conclusion. |
| [44986038617](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44986038617), job `137096700700` | `99d376c616817262d0da79927352732fdb827e64` / `eae568545b09026508ba4d4d92a694737bfbe499` | Two tests failed and reproduced the proxy/raw rejection. Hosted AppProcess wrapper used real browser conditions. |
| [44986712960](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44986712960), job `137098765694` | `311c4db9e704fbe5aa4146ba87209a8fccaf7af2` / `6578f94e59dc709691b5863a6cbf1cf61c749f46` | Passed 18 tests / 147 assertions. Clean, proxy, mixed nested and retained raw payloads preserve exact source values/URL. Omni positive control passed with one declared spawn. No installed evaluation was performed by this gate. |

The snapshot wrapper is verification-only. It runs through AppProcess with bounded output and is not part of the product. [Machine-readable input receipts](diagnostics/portfolio-inputs.json) preserve all three attempts.

## Original BI refusal

The first focused BI run repeated only the second grouped journey with response-body diagnostics. Its financial read and captures completed, but the CDP body of an original bi-source response was evicted before JSON acquisition. That is an acquisition failure, not evidence of a new source rejection or a successful BI06 result. The permanent spec now starts body acquisition immediately on the response; only if that body is unavailable does it reopen the exact authenticated original GET, after checking its installed origin/path, view, selection, value ID, digest, unique query keys and GET method. The readback URL/status must match the original response. Writes are never replayed.

A second focused run reached the operational source. BI06 returned HTTP 403 with the original body `status:denied`, `reason:access-changed`. Reopening BI05 for the same original selection returned HTTP 200 and five projection values. The diagnostic later failed while logging another response because its logger expected an object where no value existed. The run remains failed. It supplies no successful final UI screenshot.

| Run | Snapshot | Observation |
| --- | --- | --- |
| [44985679880](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44985679880), job `137095598901` | `310db7c997982ca998a4ef89ad4b0da21ccea61e` | Failed CDP body acquisition before BI06. [Artifact 14739776173](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44985679880/artifacts/14739776173), 18,219,184 bytes; SHA-256 `9b46b917c78c439d231a79d3bbf7bf30a6d25aeb53930b8881722937bf92e05c`. |
| [44986224673](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44986224673), job `137097265867` | `a1334d5fd8b800fe6841536732df0f3730085dd5` | BI06 original 403 access-changed; BI05 control 200 / five values; later logger failure. [Artifact 14740356691](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44986224673/artifacts/14740356691), 2,185,481 bytes; SHA-256 `9a79c7b06ac0641f5f6932f7084a4b838d259eb2602b05069abc998c588c0156`. |

These focused-run screenshots were not emitted for visual inspection here and are not approved or added to the reviewed gallery. [Machine-readable BI receipts](diagnostics/bi-07-08.json) preserve the exact status observations and artifacts. The original age-of-stage calculation and projection revalidation are under integration-owner investigation; equality, source availability and grants remain authoritative.

## Criterion metric physical-read observation — focused Actions comparison

After Portfolio10 registered the genuine human selection, its first preview did not return within the existing 60-second browser wait. Commit `77971245d51657866fbaa6478410315425d2d2e6` changes only the inner `readMetric` comparator call in `apps/cli/src/sucafina-product/portfolio-authority.ts` to use the existing `business.withPlannerObservation`. The observed pair, empty inner criteria, canonical readers, per-invocation observations, request/binding checks and final original result digests are preserved. The outer user-selected criterion is never removed. No comparison result is cached.

[Run 44990184354](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44990184354), job `137109310652`, passed all three selected gates on snapshot `f7ffb5546cb09d2d6708cfc93d1c58f9154908df`, based on product `796c7f27634dca55e25087cb44d1a0fe45a06cf9`: CLI typecheck, E2E typecheck and the extended original Finance pair integration test. The latter passed one test group and 62 assertions, using real SQLite/C08 and scenarios produced by the original Planner.

| Actual invocation | Result | Physical reads | Owned roots | Canonical scenario resolves | Elapsed ms |
| --- | --- | ---: | ---: | ---: | ---: |
| Complete scalar producer | ok |2501|0|4|1435|
| Grouped original reads | ok |118|2|4|1194|
| Fresh repeated invocation | ok |118|2|4|1160|
| Adapter without readSnapshotRoot | ok |2501|0|4|1366|
| Access revoked after first root closes | denied |116|1|4|1128|
| Source changed after first root closes | unavailable |118|2|4|1157|

Positive values are exactly equal, including conditioned state, original known difference, unit, period and evidence. The repeated call performs all four canonical resolves again. The unsupported adapter runs the complete original producer. Revocation and source mutation reject the grouped result without replaying work. The original separate fresh egress root and fences remain unchanged. These durations describe this scoped fixture and do not establish the native preview latency.

The receipt, exact changed blobs and measurements are in [criterion-observation.json](criterion-observation.json). Portfolio11 is the next original installed journey, with the same 60-second preview wait and direct request-emission/duration logs. It uses product `d8faa155002f0a9f3df029d946a026462af65e69` and snapshot `9b4863d87ecbb9cca0516db439e979321f3f53fb`.
