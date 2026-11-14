# W23 — C07 installed publication fixture

Builder correction, based on W22 `4bc9c7220f04f113609393aaba38934a7e69878b` / tree `082b73607bea09a0a6252e2298c5a581c10cb645`. This package is not an independent review or a hosted acceptance.

## Observed failure

W22 run `43609220130`, job `132490362081`, failed the fifth complete test at raw log line 924 after 397.67 ms: `invalid-manifest` / `resident-source-already-registered`. The other four cases in this file passed. The complete hosted A observation was 37 pass / 2 fail / 39 tests; cleanup job `132492560014` succeeded. The other failing test concerned historical Memory and is outside this change.

The shared fixture had registered `.orchestra/skills` as an ordinary catalog source. The fifth case passed that identical root to the real resident producer. `registerSfResidentAgents` correctly rejects this before creating a resident Session; its guard must remain.

## Minimal correction

Only the fifth setup writes the already defined real `SKILL.md` bytes to `resident-skills/sf-explicar-forecast/SKILL.md`, under a root outside the ordinary catalog directory. It then calls the same real resident producer with that root. The real SkillV2 reserved ownership chooses this managed copy. One additional assertion checks the actual selected catalog location and parsed content. No source is removed and no capability is fabricated.

The real loader still verifies a unique physical owning root, source and instruction digests, private registration capability, actual Session skill message, and post-load invariants. All identity, archive, unarchive, lease-revocation and Session-removal checks remain byte exact from `Session.create` onward.

## Preservation and scope

The four already passing test bodies, imports and shared fixture remain byte exact. All five names and 120000 ms budgets remain. All 51 original expect expressions remain; one catalog assertion was added. The earlier real process-global SessionExecution export fix remains. Provider, Session, AuthoringStore, catalog implementation, duplicate-source guard and all foreign code remain unchanged.

The separately sealed W23 scenario fixture still has SHA256 `9d0675797aa2f575b7ba9b2193ce93db54db6f34faeee5cd8264abe8cc544191`.

Only static source reading and pure data/text/hash comparisons were performed. No product was imported, tested, built or typechecked locally, and no remote mutation or CI dispatch occurred. The complete file must run in hosted CI on the successor. This correction does not claim a successful native routine Task, approval, ledger or global epic.

## Deliverables

- `own-diff.patch`: one allowed test file.
- `base/` and `package/`: exact W22 base and successor bytes.
- `source-manifest.json`: inspected API/producer bytes checked against the W22 tree.
- `hosted-causality.json`: exact run, job, raw-log hash and failure.
- `verification.json`: preservation and nonexecution evidence.
- `change-manifest.json`: path, base/new Git blob and SHA256.
- `seal.json`: package hashes.
