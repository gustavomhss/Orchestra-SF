import { expect, test } from "bun:test"
import { assertStaticOwnership, readStaticProof } from "./ci-static-contract.ts"

const mutations: [string, string, string][] = [
  ["injected workflow shell environment","env:\n  CI: \"true\"","env:\n  BASH_ENV: /tmp/ci-bypass\n  CI: \"true\""],
  ["injected static shell environment","  static:\n","  static:\n    env:\n      BASH_ENV: /tmp/ci-bypass\n"],
  ["injected verifier Node environment","  verify:\n","  verify:\n    env:\n      NODE_OPTIONS: --require=/tmp/ci-bypass\n"],
  ["injected typecheck Node environment","      - name: Typecheck runtime, host, product and app\n        run:","      - name: Typecheck runtime, host, product and app\n        env:\n          NODE_OPTIONS: --require=/tmp/ci-bypass\n        run:"],
  ["injected guard command path","        env:\n          SF_PR_BASE:","        env:\n          PATH: /tmp/ci-bypass\n          SF_PR_BASE:"],
  ["injected precheck shell environment","      - name: Diagnose upstream gates before downloading suite artifacts\n        env:","      - name: Diagnose upstream gates before downloading suite artifacts\n        env:\n          BASH_ENV: /tmp/ci-bypass"],
  ["injected final verifier Node environment","      - name: Fail closed on every missing/failed suite, skipped job or mismatched SHA\n        env:","      - name: Fail closed on every missing/failed suite, skipped job or mismatched SHA\n        env:\n          NODE_OPTIONS: --require=/tmp/ci-bypass"],
  ["guard independence removed","      - name: Security and dependency guards with both original and PR bases\n        if: ${{ !cancelled() }}\n","      - name: Security and dependency guards with both original and PR bases\n"],
  ["missing Sucafina typecheck","          (cd modules/sucafina && bun run typecheck)\n",""],
  ["narrowed package typechecks","          (cd packages/server && bun run typecheck)\n",""],
  ["swallowed typecheck failure","          (cd modules/sucafina && bun run typecheck)","          (cd modules/sucafina && bun run typecheck) || true"],
  ["early typecheck success","      - name: Typecheck runtime, host, product and app\n        run: |\n          set -euo pipefail","      - name: Typecheck runtime, host, product and app\n        run: |\n          exit 0\n          set -euo pipefail"],
  ["conditional static owner","  static:\n","  static:\n    if: false\n"],
  ["optional static failure","  static:\n","  static:\n    continue-on-error: true\n"],
  ["conditional guard step","      - name: Security and dependency guards with both original and PR bases\n        if: ${{ !cancelled() }}","      - name: Security and dependency guards with both original and PR bases\n        if: false"],
  ["optional guard failure","      - name: Security and dependency guards with both original and PR bases\n","      - name: Security and dependency guards with both original and PR bases\n        continue-on-error: true\n"],
  ["missing canonical guard","          bun run check:guards --base origin/dev > \"$evidence_dir/guard-dev.log\" 2>&1\n",""],
  ["missing PR-base guard","          bun run check:guards --base \"$SF_PR_BASE\" > \"$evidence_dir/guard-pr-base.log\" 2>&1\n",""],
  ["missing spawn guard","          bun run check:spawn-imports > \"$evidence_dir/spawn.log\" 2>&1\n",""],
  ["swallowed guard failure","          test \"$spawn_status\" -eq 0 && test \"$dev_status\" -eq 0 && test \"$pr_status\" -eq 0","          test \"$spawn_status\" -eq 0 && test \"$dev_status\" -eq 0 && test \"$pr_status\" -eq 0 || true"],
  ["early guard success","          evidence_dir=\"$RUNNER_TEMP/guard-evidence\"","          exit 0\n          evidence_dir=\"$RUNNER_TEMP/guard-evidence\""],
  ["forged guard approval","GUARDRAIL_APPROVED: ${{ contains(github.event.pull_request.labels.*.name, 'guardrail-approved') && 'protected-paths' || '' }}","GUARDRAIL_APPROVED: protected-paths"],
  ["missing static dependency","    needs: [preflight, static, omni, unit, unit-sf, ui]","    needs: [preflight, omni, unit, unit-sf, ui]"],
  ["conditional aggregate","    if: always()\n    needs:","    if: false\n    needs:"],
  ["optional aggregate failure","  verify:\n","  verify:\n    continue-on-error: true\n"],
  ["conditional prerequisite check","      - name: Diagnose upstream gates before downloading suite artifacts\n","      - name: Diagnose upstream gates before downloading suite artifacts\n        if: false\n"],
  ["forged upstream conclusions","          SF_NEEDS_JSON: ${{ toJSON(needs) }}","          SF_NEEDS_JSON: \"{}\""],
  ["early aggregate success","          node script/sf-ci/gate.mjs verify\n","          exit 0\n          node script/sf-ci/gate.mjs verify\n"],
  ["ignored aggregate failure","          node script/sf-ci/gate.mjs verify\n","          node script/sf-ci/gate.mjs verify || true\n"],
]

for (const [name, before, after] of mutations) {
  test("static ownership rejects " + name, async () => {
    const proof = await readStaticProof()
    const changed = proof.workflow.replace(before, after)
    expect(changed).not.toBe(proof.workflow)
    expect(() => assertStaticOwnership(changed, proof.prerequisite)).toThrow(/SF_CI_STATIC_OWNERSHIP/)
  })
}

test("static ownership checks the real workflow and prerequisite checker without running compiler commands", async () => {
  const proof = await readStaticProof()
  expect(() => assertStaticOwnership(proof.workflow, proof.prerequisite)).not.toThrow()
})
