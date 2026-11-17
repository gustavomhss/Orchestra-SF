# A6 W1 evidence boundary (2026-11-16)

Status: **NOT QUALIFIED** until fresh GitHub Actions execution on the resulting SHA, negative controls, and independent A1 review. This document is a source trace, not a PASS receipt. No Azure VM, Entra identity, F04, AM01–AM06, backup, or release approval is asserted.

## B1 — compiler graph inclusion witness

Original positive control: `.github/workflows/sf2-epic.yml:1023-1058`. A6 has copied the **two actual compiler invocations** into `sf-ci.yml` static as a separate `if: !cancelled()` step; product typecheck failures cannot skip collection. On the GitHub Actions checkout: (1) verify `GITHUB_SHA == git rev-parse HEAD`, Linux X64, export `SF_PRODUCT_TREE=HEAD^{tree}`; (2) run `bun run typecheck:sf-e2e --showConfig` and `--listFiles --pretty false` in `packages/app-shell` with **independent real exit codes**; (3) invoke unchanged `script/sf2h/final-bundle/verify-e2e-typecheck.mjs` with config+list logs and both statuses; (4) emit `inclusion.json`, `sha256sums.txt`, `command-statuses.json`, compiler logs and Bun version in an independent, SHA/run-attempt-addressed Actions artifact, even on RED.

The original verifier insists on the full `e2e/sucafina/**` helper tree, nominal three specs, strict/noEmit/noResolve policy, runtime roots, configured compiler inputs, and each existing file in the **actual compiler --listFiles graph**. Failure in either compiler step, an omitted spec/helper, invalid config, missing output file, or mismatched SHA/tree is **RED**. This file records *implemented wiring only*: no CI command or negative control has been executed by A6 locally (GitHub MCP only).

**Tamper controls to run on a disposable reviewer checkout (A1/A2; never edit protected paths or publish tampered C):** remove a nominal spec from `tsconfig.sf-e2e.json` or an importable helper from its include graph, prove verifier returns nonzero and records `CONFIG_DRIFT` or `PROGRAM_OMISSION`; then restore baseline and prove full inclusion on C. Also force a nonzero `--showConfig` or `--listFiles` status, verify the job/artifact cannot declare PASS. Record head SHA, tested merge SHA, tree, run attempt/job/artifact IDs. This document itself is not such an execution.

**Current state: B1=WIRED_NOT_PROVEN.** Owns only `.github/workflows/sf-ci.yml` and the already-existing verifier path; not the A5 specs, not A2 selectors, and not the Azure release fixture. A1 must adjudicate tamper and cold review.
