# W26 A — terminal authority/lifecycle observation

Product `a1434e7ea7340aa1d1c8ce6bb48958b724218170`, tree `a9398de38c9e684d28c27b0188ab653e75bf3305`; snapshot `dd53af531181d1b05e5081b765dbfecc2a6ba6a9`, tree `ab3895d693c0923a8e26aebe03654cce1854149d`; run `43618475702`, test job `132518644009`.

The strict data-only normalizer completed: **45 pass, 1 fail, 46 tests, 8 files, 1,904 expectations, 391.43 seconds**, no skips or unhandled errors. C07 installed publication has5/5 passes, the new generic record scope3/3, preserved evidence scope4/4, Work11/11, Memory services6/6, analysis services5/5 and native inputs11/11. The whole run remains failed.

The sole failure is the one historical Memory test. Its 225,000ms cooperative deadline expired during `memory.same-request-new-proof`; Bun reports225,029.32ms, with the outer240,000ms deadline unchanged. Source/capture/principal/clock/lease/final-header probes ran before that phase. The subsequent stale lifecycle/cancellation/corrupt-capture/revocation tail was not reached and receives no acceptance credit.

Prepare, verify and accept-output measured37.782s,37.979s and37.861s. Each observed six canonical contexts, four contexts inside the grouped case read, and two complete Atlas observations. Prepare reported11,030 Persistence API calls/3,450 root API calls; verify and accept-output each11,072/3,492. These are not physical connection or commit counts, and this package claims no time speedup against another runner. Every captured phase and exact raw-log line is in `triage.json`.

Omni reports PASS: one declaring test, two spawns and zero delegation. That control does not grant native inference acceptance. Cleanup job132521071078 and Delete the snapshot branch both succeeded. The actual artifacts API returned an empty list.

Raw log:95,897 UTF-8 bytes,95,895 characters,1,093 LF and zero CRLF; SHA256 `b4b41f42838860c118967c8a08182f9f0cf2af01835bd2b1cf3ce8817c8f7f41`. Captured tool content and raw bytes are identical. Normalized records are under `evidence/W26/normalized/A-authority-lifecycle`.

This observer changed evidence only. No product import/test/typecheck/build, source mutation, branch operation or CI dispatch occurred. The candidate identity is W26 throughout; no scoped pass changes the failed run into a global, native, criterion or independent-review acceptance.
