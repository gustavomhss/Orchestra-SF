# A6 W1 evidence boundary (2026-11-16)

Status: **NOT QUALIFIED** until fresh GitHub Actions execution on the resulting SHA, negative controls, and independent A1 review. This document is a source trace, not a PASS receipt. No Azure VM, Entra identity, F04, AM01–AM06, backup, or release approval is asserted.

## M3 / CI-09 — canonical dev versus PR-base guard receipts

Historical Epic: `.github/workflows/sf2-epic.yml:1000-1021` fetches `origin/dev` and runs `bun run check:guards --base origin/dev`, emitting a base/checkout/status receipt. Previous `sf-ci.yml` instead used the PR base SHA or frozen `ae7850a7e397e8f0e60033ae4c5eca5e11b77c7f`, which was **not equivalent**.

A6's static lane now runs guards even after typecheck RED (`if: !cancelled()`). It fetches the live `origin/dev` with the ephemeral Actions read-only token (the checkout persists no credentials), then executes `bun run check:spawn-imports`, canonical `check:guards --base origin/dev`, and independent `check:guards --base <PR base SHA>` on **the same checkout**. All **three** results are enforced, not suppressed; the receipt includes exact candidate SHA, tree, real run ID/attempt, Linux runner, both base SHAs and exit statuses, plus hashed logs. The artifact is published on RED as well as PASS; on `workflow_dispatch`, the comparison base resolves the actual `close-final-candidate` branch head. There is no `GUARDRAIL_APPROVED` setting and no mutation to guard engine/waiver/spawn paths.

At W0 inventory, `dev@a1d37698a7bb097c1578f827eba6a19b9917ef07`, `close-final-candidate@1cb77b8deb144e01a655c36987922338b1474003`. Those are **read snapshots**, not a substitute for recording the fetched base SHA at runtime. F0 merge on `sfa-ci-integration` carries the candidate-authored `script/godfile.ts` blob unchanged; the PR diff against `close-final-candidate` confirms that protected path is absent. No A6-authored edit, waiver or approval was made there.

**Status: M3=WIRED_NOT_PROVEN.** The release blocker persists until an actual run proves the two guard bases, their per-rule delta (not just total warning count), the spawn gate, receipt identity, and no protected-path bypass. A1 owns independent check; A10/owner handle any protected exception or branch ruleset 403; A6 may not alter `script/godfile.ts`, `script/spawn-imports/**`, `script/guards/**`, or `godfile-waivers.json`.
