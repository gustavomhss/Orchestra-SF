# Reconstruction · 50-session delegation package (V5)

**Plan and delegation only.** No product code, CI validation, merge or deployment was performed for this package.

- Initial state: `PREP_ONLY` across all 50 sessions. All waves can begin **preparation** concurrently; implementation follows documented receipts and ownership gates.
- Frozen source baseline: `sf2-stack@bc5eb1e0cead17254a95770e437f6fda826a66fc` (branch origin for this documentation commit; confirm current owners before code writes).
- Read [sessions/COMMON.md](sessions/COMMON.md), then exactly one [sessions/{ID}.md](sessions/) and its entry in [execution-50.json](execution-50.json).
- [execution-50.json](execution-50.json) is the machine-readable plan, DAG and path-ownership source.
- [ledger-initial.json](ledger-initial.json) is an **initial** placeholder ledger, not evidence of released or completed work.
- [plan-50.docx](plan-50.docx) is the human-facing plan.
- [session-pack-50.zip](session-pack-50.zip) is an exact portable copy of the original 54-file delivery (50 missions + common + execution + ledger + plan).
- [manifest-sha256.json](manifest-sha256.json) verifies the source contents.

**Never edit `sf2-stack` or another owner's paths from this delegation branch.** This branch contains planning artifacts only. Individual sessions must revalidate HEAD, contracts, AGENTS, and owner reservations before writing code.
