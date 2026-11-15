# Mission 139 / S01 — fresh e2 correction handoff to 132

**State:** `ARTIFACT_READY` on `sf-ux-w06`, **NOT INTEGRATED / NOT QUALIFIED**. `GLOBAL_RELEASE=false`; native Goal remains paused.

## Custody and authority

- S0 fence: `S0-FENCE.json` blob `12fd8c2df494ca090b59afb4ee64fd2658c36a50`. Older `ux-native-w06-e1` future-writes authority revoked. No runtime-death inference.
- Real fresh ACK: commit `4f6ff9d93b06d18acf9e50e0f0909007312702c9`, file `ACK139.json`, actual GPT-6, session ID not exposed.
- Corrected source code commit: **`b694342c38a9877619f4cd5a4fab97106a0d14c0`**, tree `81d54c4a10fe921e74cf58178f98de419c476c73` (CAS expected-head, force=false). Original authors/commits retained.

## Confirmed cause and exact delta

Compiler128 C64 run **43738074189**, job **132884987559**, reports `shared/table/index.tsx(226,31): TS2657 JSX expressions must have one parent element`. The `<For each={actions(row)}>` callback returned a button next to a conditional `<Show>` without one JSX parent.

Changed only two granted product/test files:
1. `packages/app-shell/src/orchestra/chapters/sucafina/shared/table/index.tsx`: wraps both siblings in `<></>`, preserving semantic button, reason span, state/role/disabled/busy guards, event payloads, focus, selection, i18n and original `SfDataTableProps<Row>`. Blob `eec796343345a7ce7b3d30f4b86055000b6847c2` → **`5523d9cc6680f8461e4f2a5ef31c687a7432dfbd`**.
2. `packages/app-shell/test-browser/sucafina-native/s01.test.ts`: extends only the existing fixture with reason/busy and adds the regression for siblings, reason/title, disabled, focus/ref, busy, outcome-unknown, denied. Existing tests/assertions remain. Blob `f0323b6b0711f7b034686214b1371747351a492d` → **`65c74a68a7658706b18e70c5f98e52a419910fb3`**.

**Complete exact patch:** [PATCH139-S01.patch](PATCH139-S01.patch), Git blob `031d53dce25ae94c7b7e0a51b46fd1eaf8f50f1b`. Machine-readable preimages, postimages, contracts, criteria and run evidence: [RESULTS139.json](RESULTS139.json).

## Consumer preimage, composition and acceptance

Observed `sf2-stack@fc8840207377a363d4e6844aab496b4f1521f83c` and C64 `8f933d3249f49e1234b745036672d7c7a6aabcd4`: both table preimage `eec796343345a7ce7b3d30f4b86055000b6847c2`. The consumer test preimage was `f0323b6b0711f7b034686214b1371747351a492d`. This only proves a clean patch base at observation, **not** that 132 has admitted or integrated the fix. 132 must recheck new HEAD and existing F01/F03 typed/i18n dependencies before applying by its own authority.

**Never merge PR125 as a whole:** W06 inherits a large prepared native-UI cohort; only import the exact two-file patch and correction139 receipts. Do not overwrite other authors' paths, copy stale full files or rewrite shared registries.

## Regression and evidence status

- New selected test: `packages/app-shell/test-browser/sucafina-native/s01.test.ts`, case `row action reason and button remain sibling elements with intact authority and keyboard gates`. Includes no reason, optional reason, accessible title, non-fired disabled/busy/outcome-unknown callbacks, keyboard focus and record ref identity, denied DOM purge.
- Existing opaque-identity, sorting/paging, same-owner list/detail focus/scroll, and denied/session-expired tests were not weakened.
- **NOT_RUN:** no local tests, parser, validator, typecheck, guards or SDK; no new GitHub Actions dispatch by mission139. Historic C64 compiler run is failed evidence, not a post-fix success.
- Other historic compiler failures (guard run and `packages/client` generation with malformed `sucafina.installations.query` schema) are separate and not claimed fixed.
- S01-AC01/S01-AC02/WP01.T02 are **SPEC/ARTIFACT ONLY, NOT QUALIFIED**.

## Routing and checkpoint

- **132** is sole integrator/shared writer: inspect exact two-file patch against current consumer, compose on its coherent candidate, record real admission/ACK and forward integrated SHA.
- **128** owns hosted compiler and **real** `packages/client bun run generate`, after integration. Do not fabricate generated SDK or a green typecheck.
- **129** owns surgical hosted CI on the coherent integrated SHA; select `s01.test.ts` with the existing deduplicated harness, not a new dispatcher.
- Source handoff is **OFFERED**; no consumer acceptance or terminal lease release inferred. No dev merge, deploy, force/reset, Goal restart, new financial/access rules or parallel backend.

PR: https://github.com/gustavomhss/Orchestra-SF/pull/125
