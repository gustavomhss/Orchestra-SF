# Handoff116 — product TS repairs (source ready, tests pending)

**Source material:** [b2b56c8e4583cc01ddad9b30733c45003fbd982d](https://github.com/gustavomhss/Orchestra-SF/commit/b2b56c8e4583cc01ddad9b30733c45003fbd982d) (tree `776a34cdacdd46291ea0e1c571768d1aff1347df`, parent ACK `0cda65fe05e6fd4b6efc5aa40b69c94ba3b6e386`), C53 baseline `180212940105e7b9ad15171b067c1c1b7841df5f`. Fixed plan `dbf9547211d9b0fade619790de7c19c0869b7c7d`. Lease `product-types-browser116`, branch `product-type-repair`.

## Source changes

1. `bi-services.ts` TS2322: annotate `ScenarioBiHost.readView` with `Promise<PortResult<{ projection: DomainProjection; presentation: BiPresentation }>>`; preserves producer status branches, field types, waterfalls, timelines and unquantified costs.
2. `current-choice-services.ts` TS2345: instantiate `run<SfCurrentChoiceOptions>` in options; both `{ cases }` and `{ cases, selected }` stay valid while human admission, case and source fences remain.
3. `composite-planner.ts` TS2367: `find(status !== "ok")` narrows `failure`; `if (failure) return failure` preserves all non-OK statuses and retains external-operation unresolved-cost and evidence policy.
4. `agenda-picker.ts` TS2339 ×2: explicitly guard `title` existence and `contractRef` membership for procurement variants; preserve existing domain/kind, periods, source fields, and invalid-input refusal.

**Artifacts:** [ACK116.json](ACK116.json), [PATCH-116.patch](PATCH-116.patch) (complete source-only GitHub diff), [PREPOST-116.json](PREPOST-116.json) (four exact Git blob pre/post pairs and diagnostic map).

## Verification and limits

- GitHub source commit has **exactly four modified files**. Each postimage was fetched remotely and matched its Git blob SHA. No test file/fixture/oracle, policy, source schema or workflow edited.
- Source compilation is **NOT_RUN** in this session: **119 owns hosted Bun typecheck**. Surgical GitHub Actions product tests remain **NOT_RUN**: **120 owns dispatch/dedup**. No local test, direct tsc, merge, force, release, Azure or deploy.
- The 108 C53 compiler run [43708496555](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43708496555) failed (119 errors in 56 files). These four diagnostics were allocated here; fixing them does **not** prove global typecheck or C final acceptance. The 108 suggested patch was independently checked against real C53 contracts; it was not treated as a verified pass.

## Integration request to 114 / PR65

Consume only the four exact material postimages after checking base preimages, subsequent HEAD deltas and ownership. **Do not** copy this whole branch or overwrite later valid fixes; preserve the original non-OK statuses, choice-private fences, scenario external-cost pending state, and agenda discriminants. The three receipt files are source evidence, not a new product C qualification. Re-run affected compile/CI on the **resulting integrated source SHA** through 119/120. Release only after the campaign's unchanged mandatory gates. Consumer ACK remains **PENDING**.
