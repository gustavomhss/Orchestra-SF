# Mission 210 · EVIDENCE-ARCHIVE · handoff to 189/190/208

**Source authority:** `evidence-archive-e1-browser210` · `sf-guard-archive` · [PR #192](https://github.com/gustavomhss/Orchestra-SF/pull/192) (draft to `sf2-stack`). Effective model **GPT-6**; session ID **not exposed**. ACK commit `343e32088b32e50ca5698ea70b5f783e2412321d`.

## Delivered, with readback

- `INDEX-210.json`: **55/55** historical logs individually fetched with GitHub MCP both by exact pinned `690a34cdd81c12d7311f3717c19679b950276161` path and immutable Git blob; contents, SHA-1 Git object IDs, and UTF-8 byte counts agree. No log bodies copied into receipts; no sensitive output reprinted. Historical W is an ancestor of this branch; original three subtree SHAs are unchanged.
- `PREPOST-210.json`: 55 exact **pre=present+unchanged / post=present+unchanged / authorized deletion=false** entries. **0 logs removed**. Old receipts and approved planning untouched.
- `CONSUMERS-210.json`: the nine package-pinned documentary consumers plus **60 additional lexical references**, observed through GitHub MCP blob reads of **142 immediate-neighborhood** and **221 ancestor metadata** files. All 55 logs have reverse consumer mappings. Scanner configuration matches may be basename collisions, not actual readers. This is *not* an exhaustive repository-wide/dynamic consumer proof.
- `READER-210.mjs`: executable, read-only Git SHA/size verification and full-tree consumer scanner. Its `readPinnedLog(index, idOrOriginalPath, githubMcpFetchBlob)` accepts an explicitly supplied GitHub MCP provider, verifies original bytes before returning them to an authorized consumer **without printing the bytes**. It makes no network calls, writes or deletions by itself. Intended commands for the authorized integrator (not executed here): `node READER-210.mjs status`, `node READER-210.mjs verify-tree --root <repo>`, `node READER-210.mjs scan-consumers --root <repo>`.
- `INERT-189-READER.patch` with `INERT-189-MANIFEST.json`: full patch to **add** `script/sf2h/archive-evidence-reader.mjs`. Preimage verified *absent* in `sf2-stack`; this patch is deliberately NOT applied by 210 outside its lease.

## Causal holds (no waiver, no invented PASS)

1. Immutable legacy manifests and documentary receipts still reference paths; all dynamic and external consumers require end-to-end equivalent readback before a candidate deletion. Readers are not migrated solely by having an index. **No log qualifies for removal now (0/55).**
2. Package's expected SHA for `rolling-intake-42/reports36-semantic-review.json` = `c0e1c3baff457e94f18e7d7a8c2179e541209d`; actual live SHA = `c0e1c3baff457e94f18e7d7a7d8c2179e541209d`. This preimage discrepancy needs 189's disposition, no edit of the original.
3. Historical 163 `FAIL 66` (55 logs, 1 F04 helper, 10 skips) is not contemporary C/D proof. 188 and 189 did **not** establish safe disposal. Neither guard rules nor allowlists, ignore labels, skips, F04 scratch, source files, receipts or plans were modified.

## Next exact gate, owners and checks

**189**: pin live `sf2-stack` W/source preimages and this PR HEAD; read `INDEX-210.json`, `CONSUMERS-210.json`, `PREPOST-210.json` and patch manifest. Reconcile consumer SHA mismatch, execute the full-repo consumer scan and inspect dynamic readers, then integrate the inert reader by CAS only if justified, migrate/qualify each active reader and prove identical bytes for every consumer. Keep log if any consumer remains unproven. No direct edit of immutable receipts.

**190**: only after 189 creates an integrated W with actual source consumption and an immutable request, run the **real guard** on exact W/merge base. A historical snapshot, the archive index or a passed SHA readback is never current Guard PASS. **208**: independent readback/retention and consumer-equivalence review. **200 / PR #106**: sole product dispatcher; request a nonduplicated surgical test only if real consumer code changes require it. **199** owns F04, and U15/U39/U40 remain with their owners.

**Not run by 210:** tests, local validators, typecheck, build, CI, or current guard. **GLOBAL_RELEASE=false, Goal paused.** Checkpoint: `archive210/HANDOFF-210.json` specifies blocker IDs and the exact minimum input/actions.
