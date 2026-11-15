# Mission52 — J1 nominal05 timing and transport review

Status: runtime artifact interpretation plus static source review; no test, compiler, product execution, mutation or dispatch performed. No timeout increase is proposed.

## Observed failure

Run43662317407 used S `0bb51dc6f12a92f4ee590482faf70e7d842e4415`, W `19a48b5f97247e53f34e841a81841ea2ef94b09b`, base C25. J1 retained its original title: **CI-UI-DECISIONS — attach evidence, compare two alternatives and preserve the human choice after a source change**.

The runtime report records failure after69054ms, retry0, budget180000ms. Both alternatives were promoted successfully and the lost second creation response was reconciled. The final observed network event is one `POST /sucafina/dashboard?sf=decision-compare` request failure `net::ERR_ABORTED`, without an observed HTTP status/body. Its command key was retained in the receipt. No subsequent numeric rule, human choice or historical change step is reached.

The failure DOM shows the existing Compare catch text, “Comparison unavailable or sources changed. Check the alternatives and try again.” The Record choice button remains disabled and the history says no human choice recorded.

| Step | Runtime duration ms |
| --- | ---: |
| create two actual Planner versions through human controls | 1873 |
| discover and inspect authorized sources before attaching them to the saved case | 4390 |
| save the first alternative with an explicit pending cost inventory | 8838 |
| lose the second creation response and explicitly recover the identical request | 13469 |
| reopen the exact alternatives and consume them in the current comparison | 16299 |

The final step's16299ms includes opening/reopening the case and selecting controls. It is not a measured duration for the POST itself. The raw Playwright runtime JSON has test startTime and step durations but no startTime per step; the observations network entries contain no timestamps. The artifact contains videos/screenshots, not a trace or HAR. Therefore an exact request-to-abort elapsed duration cannot be extracted from these records alone.

## Actual browser deadline

W5 `modules/sucafina/Sucafinav1/product/ui/decision-choice.ts`, blob `0a330a1377326e3ea919b4714cada83a208efc39`:

- Lines138–149 define the shared send function. Line140 creates AbortController and schedules abort after **10000ms**, not15000ms.
- Line142 passes controller.signal to the actual same-origin POST; line149 clears the deadline.
- Lines163–169 route the Compare button through this send function.
- Lines178–179 display the exact observed catch message and unlock controls.

This makes expiry of the existing ten-second UI deadline consistent with the observed browser failure. The existing logs do not identify whether the producer spent that interval in CPU work, repeated source reads or a wait. The test's180-second budget is separate and was not exhausted.

## Server and storage cancellation chain

W5 `apps/cli/src/sucafina-product/installation.ts`, blob `5d9fe7ec2f070dbbedc2bdbfff4c8458e1187437`, is byte-identical to the reviewed C23 body-buffer proposal. Lines46–48 consume the request body in the server effect, and line51 passes Effect.tryPromise's signal into the final Request given to installation.handler. The bounded body reader, Microsoft transport bridge, host/origin checks, privacy and final signal remain intact.

The exact pinned upstream NodeHttpServer implementation, commit `cd7ab658994104bd6fe8f841f1440bea32c387f5`, blob `f6838fb329942f4db1f3894eecf5e3d3ee57b28a`, lines195–198 interrupts the request fiber when the client response closes before writableEnded. Thus the static path propagates a client disconnect to the handler Request; no missing-signal defect was found here.

W5 `runtime/local-store.ts`, blob `e9da289bdce680f2429904c1e83dec60c39aa2a8`, retains:

- Default lock admission budget5000ms at line13, independent of the UI deadline.
- Abort checks in inherited scopes and before/after operations at lines112–117,129,136,149–154.
- Nested source reads reuse the existing AsyncLocalStorage scope at lines187–222 and refuse nested writes.
- Root transaction/transactionAll retain abort checks before commit at lines301/309 and329/339.
- Lock wait and retry helpers attach abort listeners and clean them up at lines377–420.

These checks prevent late committing after cancellation when the transaction observes the signal. They do not prove the producer can stop synchronous computation immediately, nor locate the work that exceeded the UI deadline. The outer transport redacts noncanonical failures; an already closed client cannot receive its fallback response.

## Limits and next useful discriminator

The attached CLI log is545bytes/19lines: server startup, watcher, project copy refresh, disabled LSPs and booting location services. It contains no HTTP timing, comparison phase, lock timeout, stack trace or process error. There is therefore **no runtime evidence for a lock deadlock or a new Bun body-destroy cause** in this artifact.

The independent producer review should locate a concrete recursion/repeated-reading or lock acquisition path before proposing a functional fix. If source analysis cannot distinguish those causes, the missing discriminator is bounded server-side phase timing for this real comparison call, with stage name and elapsed duration only; it must not log payloads, credentials, headers or change the UI deadline. This note does not add that instrumentation or authorize another run.

No transport patch is proposed from these logs: the evidence establishes the failed original request and the unchanged cancellation chain, not a new transport defect.

## Primary evidence

- `/workspace/scratch/fec39c0682b3/m52-audit/nominal05-43662317407/observations-line-12.json` — SHA256 `f19b93e9cf1fcab170efb310abd09ea23de7da660e25aa2f206a94e43b833a64`.
- `/workspace/scratch/fec39c0682b3/m52-audit/nominal05-43662317407/runtime-extracted.json` — SHA256 `9855f63cc33a0ba27c58e5d83ed0d5ac329eb6cc1bd6dfab30e1797bb7aa3d6c`.
- `/workspace/scratch/fec39c0682b3/m52-audit/nominal05-43662317407/cli-line-12.log` — SHA256 `64bc3d6d62e05ad51ec43d5df87c5307ee031ba4650bc4bf4d3efd633e572041`.
