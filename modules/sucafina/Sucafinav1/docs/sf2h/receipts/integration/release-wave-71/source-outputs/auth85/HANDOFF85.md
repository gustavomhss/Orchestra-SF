# M85 — terminal bounded handoff to 71/S0
Mission 85 | Orchestra SF | PR #84 (`auth-retention-fix`) | candidate **C38** `943b3fc6919eecb55556b05c48f07c9dbba1c530`.

## Terminal status
**AUTH72+READONLY59+MICROSOFT49 SCOPED PASS ON C38. GLOBAL RELEASE = false.**
No product edit by M85. The actual integrator 71 already composed auth72 on C38; M85 performed validation, not an additional merge. Independent recheck84 and owner45 checks remain required.

## Authority and lineage
- Source72 terminal `2690de74b0581130ae92e1129d986d31d1663fe8`; M85 ACK85 published at `8620ae3169ec1dff919b6066b05008f20227d230` via parent-SHA CAS on the same PR84.
- C37 baseline `bc5eb1e0cead17254a95770e437f6fda826a66fc`; isolated overlay `5db743c86984c9c5772920eeaf8c52b1c42880b5` (14 exact files); integrated C38 `943b3fc6919eecb55556b05c48f07c9dbba1c530` (13 identical code/test/fixture blobs; 14th metadata-only map rebind).
- Complete 14-file patch `COMPOSED-C38.patch`, Git blob `575744ad21f4981a9d44150bd9dc4a67a07489ee`, bytes **79,443**, SHA-256 `6c9e5840d82a755e33193fd9812c7295392b6d50a7aefe74c9336577944aa94e`. This is the exact patch created by 71; **do not apply it a second time** to C38. See `MANIFEST85.json` for 14 pre/post blobs.
- Microsoft fixture/entry/installation/serve/map verified; the C38 map differs from owner72 only in base, composer and validation text. Any later 74 changes must rebind actual hashes.

## Real GitHub Actions proof (all existing `.ci-run.json`/test-ci; cleanup succeeded)
- Source72 R1 `43671466268`: 138 pass, 2 inherited skips, 0 fail; source ONLY.
- Broad overlay R1 [run 43674892252](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43674892252), job `132692758554`: **124 pass, 1 fail**, 125 tests/14 files, 1173 assertions. Both new readonly59 cases passed. Failure in **existing Procurement route test**, `test/microsoft-routes.test.ts:162`, expected **403**, observed **404**.
- C37-only negative control [run 43675205091](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43675205091), job `132693712493`: **4 pass, 1 fail**, reproduces the *same* test/line/status **without owner72**. This excludes newly composed auth72 as the cause of that mismatch; it does not approve the foreign contract.
- Focused overlay [run 43675212157](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43675212157), job `132693732478`: **120 pass, 0 fail, 1075 assertions**, 13 auth+readonly+Microsoft suites. The foreign suite was **separately retained as an OPEN failure**.
- Actual integrated C38 [run 43675427012](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43675427012), job `132694393020`, snapshot S `54281c363ea6c0ba4a15a7b3335a08a52f77d79e`: **120 pass, 0 fail, 1075 assertions**, 13 files, exact source candidate C38. The two original NOT_RUN readonly tests now PASS.
- Omni positive control is **NOT_APPLICABLE** to these narrow selections; no Omni claim, no added skip, no local tests, no new workflow, no deployment.

## Lock/fence semantics and mandatory limitations
The readonly59 root uses `BEGIN IMMEDIATE` and serializes a writer. Same-instance logout can install its **in-memory local fence** before Graph completion, while the durable SQL write still waits. **Do not call SQL-blocked logout a committed cross-process revocation**. The R3 Graph test proves a denied late identity + subsequent 204, while separate tests prove other-instance revocation *after durable commit*. The CR72-01 failing durable logout remains fenced locally for retry; pending local status alone does not survive a crash. The managed capacity cap does not cap trusted generic put globally; bounded delete does not prove secure erasure or WAL compaction, and rolling mixed old/new writers are unqualified.

## Mandatory consumer actions
1. **71**: ACK this terminal `943b3fc6919eecb55556b05c48f07c9dbba1c530`/W/S/run mapping; retain C38's code and exact readonly59 composition; do not replay owner72 patch or overwrite future 74 auth/HTTP changes. Link bounded proof without declaring global gates green.
2. **71 + Procurement73 owner**: reconcile `microsoft-routes.test.ts:162` (and stale 409/control assertions that were not reached) with the updated hidden-resource privacy contract. Verify missing and invisible requests give equivalent public response, while visible version/CAS and financial policy remain sound. Do **not** blindly turn 403 into 404 to manufacture green. The failure is proven in pre-auth C37 and remains mandatory for broad suites.
3. **45**: perform authorized compiler/typecheck/guards/CI ownership; M85 did not seize that lane.
4. **84 (independent)**: cold-recheck M70-AUTH-01 on actual C38 code and R3 logs, not source narration; consider the lock/fence, capacity and GC counterexamples. Keep reviews of Procurement and HTTP separate; this unit does not replace three final reviewers.
5. **S0**: preserve final eight selections on the *same* final C, AM01–AM06, independent reviews, candidate G7 and evidential D/G8. No `GLOBAL_RELEASE` here.

Terminal authority: M85 source branch is documentation-only after ACK85. No integration-branch write, no new product implementation, no force push or deploy. The reviewer must be independent of this author.
