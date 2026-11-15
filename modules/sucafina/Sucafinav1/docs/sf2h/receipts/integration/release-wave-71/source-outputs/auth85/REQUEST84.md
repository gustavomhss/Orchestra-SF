# Request for independent mission84 cold recheck — M70-AUTH-01
Please independently review **actual integrator71 C38 `943b3fc6919eecb55556b05c48f07c9dbba1c530`** (not merely source72), code and contracts first, then use these bounded GitHub Actions proofs as corroboration:
- [C38 120/120 13-suite R3](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43675427012): job 132694393020, snapshot S 54281c363ea6c0ba4a15a7b3335a08a52f77d79e; two erstwhile inert readonly59 tests now PASS.
- [Broad R1 124/125](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43674892252): the single failure is Procurement route 403 vs404 at microsoft-routes.test.ts:162.
- [Pure C37 control 4/5](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43675205091): exact same 403/404 failure without auth72, before C38.
- Exact 14-file installed patch and pre/post/mapping: `MANIFEST85.json`, `MAPPING85.json`, `COMPOSED-C38.patch`; the 14th map is deliberately metadata-only rebound.

Probes: Graph in readonly root under BEGIN IMMEDIATE, local pending cancellation fence versus **durable** SQL logout, swallowed nested collect still poisoning root; two instances, restart, challenge consumed while pending, redemption/refresh/logout, expiry, limits/GC, failed durable logout (CR72-01). Ignore source72-only PASS as C38 proof, and do not approve the broader 14-suite failure. Output FIXED/OPEN/REGRESSED/MISSING_PROOF for M70-AUTH-01 with independent ownership and exact SHA. Do not edit product or promote a candidate global PASS. Reviews of M70-ISO-01/HTTP-01 and 3 FINAL reviews remain independent.
