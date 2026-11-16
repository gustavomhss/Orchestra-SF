# SF Gate ↔ A6 Actions integration contract — W1 handoff

**Status:** prepared by A2 on `sfa-gate`; **NOT YET WIRED** into A6-owned `.github/workflows/sf-ci.yml`. This file is not an acceptance receipt or permission to bypass a failing product. Use only on Linux/X64 GitHub Actions for the exact checkout/PR merge `GITHUB_SHA`.

## Source of truth

`sf/ci/suites.json` governs exactly eight IDs. `node script/sf-ci/gate.mjs select` with `SF_SUITE_ID`, `GITHUB_SHA`, `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`, `RUNNER_OS=Linux`, `RUNNER_ARCH=X64` prints test paths **relative to the suite's `directory`**, one per line. All eight IDs participate: five Bun (SF entire module, CLI explicit, APP-SRC directory, APP-BROWSER directory, Atlas explicit) and three Playwright specs. CI-SF's `full-except-release-only` **must** include `porta/*.test.ts` in addition to `Sucafinav1/test/**`. New test files in admitted directories must participate, never be silently ignored. Exactly two original files remain `releaseOnlyFiles`, and AM01–AM06 are separate installed-VM obligations, not passing PR tests.

## A6 wiring pseudocode (owned by A6; A2 must not edit YAML)

```bash
set -euo pipefail
test "$RUNNER_OS" = Linux && test "$RUNNER_ARCH" = X64
test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
export SF_CHECKOUT_TREE_SHA="$(git rev-parse 'HEAD^{tree}')"
test "${#SF_CHECKOUT_TREE_SHA}" -eq 40
node script/sf-ci/gate.mjs select > "$evidence/selection.txt"
mapfile -t selected < "$evidence/selection.txt"
test "${#selected[@]}" -gt 0
# Invoke the canonical suite-specific Bun/Playwright test command, preserving
# its required browser preloads and startup order; all selected files must be
# executed, with no extra files, omissions or fake success.
# Capture the *actual* runner exit code without pipeline masking.
python3 script/sf2h/final-bundle/verify-bun-report.py "$evidence/report.xml" > "$evidence/summary.json"
SF_TEST_EXIT_CODE="$test_status" SF_CHECKOUT_SHA="$GITHUB_SHA" \
  node script/sf-ci/gate.mjs receipt
```

For Playwright, run the **one manifest-selected spec** with `--retries 0`/one worker and `--reporter json,line`, then call `sanitize-playwright` **before** `receipt`. Never upload raw output, traces, attachments, cookies, tokens or actor data. Failures must propagate nonzero and never generate a success receipt. Runner environment `SF_CHECKOUT_TREE_SHA` is mandatory for both receipt **and** final `verify`; computed only by the trusted Actions shell, not by Node `child_process` (forbidden by `check:spawn-imports`). `verify` must use its own checkout `HEAD^{tree}`. Receipts also bind source/checkout SHA, run ID, attempt, Linux X64, digest of the normalized normative manifest, report SHA256, case/file fingerprints and exact selected file fingerprint.

## Coverage M4 / source blockers

`coverage` is an **observation-only** command which emits candidate inventory/digests (without claiming PASS). Three authentic successful historical baselines from GitHub run `43956369500` are versioned in `suites.json`: CLI (34 cases/12 files), Atlas (8/4) and APP-SRC (2,408/273). The successful source artifacts were `14272990498`, `14272915730` and `14272652674` at tested merge SHA `30e8495c6e27114c8900619f4cca68191965f4f4`; they do **not** approve a new candidate. CI-SF, APP-BROWSER and three UI journeys remain `PENDING_REAL_COMPLETE_RUN`; `receipt` **fails intentionally** until A3/A4 product owners produce successful full Linux reports and an independent owner (A1/review) approves **versioned file+case fingerprints** in the manifest. Do not invent a minimum of one test or downgrade to a per-family count threshold. A changed test baseline requires explicit review and requalification; unused extras are rejected, as are missing/changed cases.

A2 test negatives cover upstream failure/cancel/skip/missing, SHA/attempt/tree/manifest digest drift, missing source files, symlink escapes, release-only omission, case mismatch and baseline shrink. Preflight is independent of product typecheck and Linux-only. **A6's YAML wiring and complete real-run receipts are dependencies, NOT claims of W1 PASS.** A1 owns independent CI cold review; A7/A8/A9/A10 and the human owner own installed Azure/OIDC/F04/AM/release decisions.
