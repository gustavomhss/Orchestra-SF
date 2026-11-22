# Portfolio24: setup failure before native execution

**The native test did not run.** Setup Bun failed while downloading Bun 1.3.14 with HTTP 403, and the workflow marked `Run tests` as skipped. This attempt provides an infrastructure-failure receipt. It provides no caller measurements, native product result, preview timeout, visual qualification or performance comparison.

## Run and source

- Run: [45037289486](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45037289486), workflow attempt 1, branch `ci-run-sf5portfolio24`.
- Snapshot: `912deed79badd8684298ae9c3799f8ef5f15e016`, tree `1f6208e17612b7d6385fdd0544d18f2e2d620faf`, parent `e4cc03bb3fa6deaed5c66f0050ffebf878dfef5d`.
- The snapshot compare contains 15 diagnostic/selection overlays. Its request blob remains `a11922821a47594d76397582be38f9b7940177ca`; its full original first-declaration spec remains `db1d7f4f0d770e5eed811070b0814c0363083c62`. Both blobs were read back exactly.
- QA base: `bba7932c542be82d8b36d88bd7315eb7c1eafdd0`, tree `3dad8152fad3fb05f7e8ec59a6dd2c9c371059a3`.
- The archive contains only this new attempt directory. It contains none of the 15 diagnostic overlays and changes no global rollup.

| Job or step | Result |
|---|---|
| Test job `137253750631` | Completed / failure, 15:15:29–15:15:59 UTC |
| Checkout repository | Success |
| Read request | Success |
| Setup Bun | Failure |
| Run tests | Skipped |
| Upload Playwright evidence | Success |
| Cleanup `137253902896` | Completed / success, 15:16:01–15:16:07 UTC |

All times are on 2026-11-22. The complete job-step metadata is preserved in [receipt.json](receipt.json).

## Exact observed failure

The setup action is `oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6`. The log resolves version 1.3.14 from package.json and starts downloading:

`https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-linux-x64-baseline.zip`

At **2026-11-22T15:15:54.1523321Z**, source line **252**, the original error is:

> Error: Unexpected HTTP response: 403

The setup action concludes failure immediately afterwards. The metadata explicitly records `Run tests` as skipped. The cause behind the HTTP 403 is not established by this job log; it is not attributed to application code, the new labels or the original native waiters.

The acquiring agent read only metadata before confirming the job completed. The final job log was then acquired once. It contains 28,820 characters and 343 split lines including the trailing empty line. The receipt preserves the relevant original setup observations with timestamp and sourceLine; no raw workflow transcript is archived.

## Measurement and image availability

No `SF_*` record was emitted:

| Emission family | Observed records |
|---|---:|
| Profiler | 0 |
| Native source events | 0 |
| Context readbacks | 0 |
| Capture events | 0 |
| Application stages | 0 |
| Native diagnostics | 0 |
| JPEG preview chunks | 0 |
| JPEGs | 0 |

These zeros count emitted records only. **Runtime counts, durations, caller populations, pending work, drops and final outcomes are unavailable, not zero.**

The intended canonical diagnostic has one span per digest, partitioned by literal surface labels or unlabelled. This run provides no population to sum and no measured caller attribution. No key count, previous total or timing from Portfolio23 is substituted. [profile.json](profile.json) records the empty acquired series and its unavailability; [aggregates.json](aggregates.json) uses null for unavailable runtime metrics.

There were no original JPEGs to reconstruct or view. The archive therefore has no gallery, byte-parity claim or performed visual review. [manifest.json](manifest.json), [source-events.json](source-events.json) and [visual-review.json](visual-review.json) explicitly record that the native test and capture stages were not reached.

## Artifact metadata

The workflow uploaded [artifact 14759824514](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45037289486/artifacts/14759824514), named `playwright-ubuntu-24.04-1`:

- Size: **452 bytes**.
- SHA-256: `74a4267756f88a59a9fc2deea45628f17f6805b1e51c21f28d9fe42df60a6092`.
- Created: `2026-11-22T15:15:55Z`.
- Expiry: `2026-11-29T15:15:54Z`.
- Not expired at acquisition.

The upload reported one file. The ZIP was not downloaded, and no claim about its contents is made. Its name and successful upload do not establish native test execution; the job metadata explicitly says the test step was skipped.

## Qualification and scope

This run adds **zero qualified areas**. It is neither a product pass nor a native test failure, because setup failed before the selected declaration executed. The original preview and sensitivity deadlines were present in the source but were not exercised.

The archive consists of seven text files, preserves the run/job/artifact and failure provenance, and introduces no new test, replay, runtime change, CI selector, global rollup or product-ref update. The new QA branch is created from the exact requested base and advances only by fast-forward.
