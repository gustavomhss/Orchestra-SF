# W20 stale reconciliation — owner publication required

**Status: NOT_APPLIED / NOT_RUN. Owner: WP10; integration: WP00/S0.**

W20 `c3b02c7693c1ff3b702596c7c8458f913972a404` publishes lifecycle and installed C07 composition, but its full `analysis-stale-commit.ts` blob `9f574a7573538c2a46796dfd650fadbac052dc80` predates the historical-calculation and retained-snapshot guards already published in current `35954072193ee08e0cdefd63c8ec03474d0b5bc5`, blob `299979047340dd76d7cc2db667b826da675a1e2e`.

## Concrete request to WP10

Please publish a reconciliation of the current `29997904` adapter with the W20 lifecycle and fourth-observation changes. `reconcile-stale.NOT_APPLIED.patch` proposes the exact merge. Its candidate blob is `392442a4ea55579953ce439aff76d549723e4891`; the patch has not been applied to the host source or published as executable code.

Preserve the exact case id/incarnation/version checks, the stored historical scenario result check, the separate temporary historical read lease, and `snapshotIdentity` pinned before any awaits. Add only the lifecycle type/optional owner and the W20 `wrapStore` handling: refuse content preservation on a lifecycle frame, clone/freeze/forward the stale observation, and route lifecycle terminal transitions to their dedicated commit authority.

`current-to-w20.diff` shows the incompatible replacement. `finding.json` distinguishes the static regressions from the required W20 increment and names the negative cases to retain. No runtime exploit or new passing result is claimed.

## Minimum composition after that publication

`minimum-closure.json` pins six published AI/C07/host files, this one owner reconciliation, and the nine published work/business prerequisites reviewed by the peer. The final host is `bdf6d4e2014cc9b2a492b6ae304948c249221e39`; the intermediate AI/C07 host snapshots do not include the complete mounted work composition. The complete 16-path proposal remains on hold until the compatible adapter is owner-published.

Keep current WP12 `analysis-port.ts` `47e25de4ed1e743a2366c234a56baf2633c805bb` and `contribution-reader.ts` `db9faeec0e1d35c0724a25a0d9cf53fee93961ee`. W20 drops later cancellation/identity checks in those files. The other four own AI sources are already byte-identical. Existing own cancellation and egress tests stay in place.

## What this can and cannot establish

After publication, hosted whole-file lifecycle, native-admission-failure and installed-publication tests can establish the new boundary behavior. Their structural run/output/lease fixtures are explicitly scoped; the installed Session and skill receipt do not imply a provider turn or C07 task execution. The exact test/helper pins are in the closure file; no test was run by this review.

C07 now supplies a real installed publication port and authoring/control materialization. It still returns `Held(SF_ROUTINE_KNOWLEDGE_PORT_UNAVAILABLE)` for knowledge, and the host still lacks a mounted routine native execution port/descriptors. Thus `sf_watch_prepare`, routine prepare/run/status/result and GNATIVE remain unproved. W20 also adds no configured model. The separate case-read lease hold remains, and real asset signing material is required for work refs.

## Evidence

- [W20 source](https://github.com/gustavomhss/Orchestra-SF/blob/c3b02c7693c1ff3b702596c7c8458f913972a404/apps/cli/src/sucafina-product/analysis-stale-commit.ts)
- [Published current source](https://github.com/gustavomhss/Orchestra-SF/blob/35954072193ee08e0cdefd63c8ec03474d0b5bc5/apps/cli/src/sucafina-product/analysis-stale-commit.ts)
- `source-pins.json`: 49 MCP source reads with independently recomputed Git blob and SHA256 digests.
- `verification.json`: exact preservation and patch checks; product/typecheck/CI remain NOT_RUN.

## Latest source check before forwarding

PR29 `532da498e08fa36fadbd3c01e3e7da00d869dd47` still has exactly the same stale adapter and host. The patch remains necessary and NOT_APPLIED. `independent-review.json` records PASS_STATIC for the frozen W20 proposal; `latest-source-check.json` records the new MCP check and the W21 test/dependency updates to review before any intake. PR40 `e8949be0e31952d5be4987c099003cd0b46e2add` still lacks the final case-read live-lease fence. Neither owner update is treated as a hosted passing result.
