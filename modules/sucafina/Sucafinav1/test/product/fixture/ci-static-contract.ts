import assert from "node:assert/strict"
import { createHash } from "node:crypto"

// Execution belongs to sf/static-and-contracts. These are wiring proofs, never
// receipts that a compiler or guard ran. The reviewed shell is locked whole:
// checking command substrings would accept an early exit or swallowed status.
// Reviewed from a5b15b51b78469a054ba97b0e87fd1e36e31f73a; a shell edit needs review.
const GUARD_SCRIPT_SHA256 = "c41fe51b3553131a13dd11596fe792dd7e31352619d45a27aecfb855c5074893"
const fail = (message: string): never => { throw new Error("SF_CI_STATIC_OWNERSHIP: " + message) }
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(label + " must be an object")
  return Object.fromEntries(Object.entries(value))
}
function steps(job: Record<string, unknown>) {
  if (!Array.isArray(job.steps)) fail("job steps missing")
  return job.steps.map((value: unknown) => object(value, "step"))
}
function named(job: Record<string, unknown>, name: string) {
  const matches = steps(job).filter((step) => step.name === name)
  const step = matches[0]
  if (matches.length !== 1 || !step) fail("missing or duplicate step: " + name)
  return step
}
function requiredStep(step: Record<string, unknown>, allowCancellation = false) {
  if (step.if !== undefined && !(allowCancellation && step.if === "${{ !cancelled() }}")) fail("conditional proof step")
  if (step["continue-on-error"] !== undefined && step["continue-on-error"] !== false) fail("ignored proof failure")
  if (step.shell !== undefined && step.shell !== "bash") fail("proof shell changed")
  if (step["working-directory"] !== undefined && step["working-directory"] !== ".") fail("proof directory changed")
  if (step.uses !== undefined || typeof step.run !== "string") fail("proof must execute a shell script")
  return step.run
}
const lines = (script: string) => script.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#"))

export async function readStaticProof() {
  const workflow = await Bun.file(new URL("../../../../../../.github/workflows/sf-ci.yml", import.meta.url)).text()
  const loaded: unknown = await import(new URL("../../../../../../script/sf-ci/gate.mjs", import.meta.url).href)
  const gate = object(loaded, "gate")
  const check = gate.requirePrerequisites
  if (typeof check !== "function") fail("actual prerequisite checker missing")
  return { workflow, prerequisite: (needs: unknown): unknown => Reflect.apply(check, undefined, [needs]) }
}

export function assertStaticOwnership(workflow: string, prerequisite: (needs: unknown) => unknown,
  requirement: "typecheck" | "guards" | "both" = "both") {
  const parsed: unknown = Bun.YAML.parse(workflow)
  const document = object(parsed, "workflow")
  const jobs = object(document.jobs, "jobs")
  const owner = object(jobs.static, "static")
  const verify = object(jobs.verify, "verify")
  if (document.defaults !== undefined || owner.defaults !== undefined || verify.defaults !== undefined) fail("implicit proof defaults changed")
  if (owner.if !== undefined) fail("static owner must be unconditional")
  for (const job of [owner, verify]) {
    if (job["continue-on-error"] !== undefined && job["continue-on-error"] !== false) fail("ignored owner failure")
  }
  if (owner.name !== "sf/static-and-contracts") fail("static owner identity changed")
  if (requirement !== "guards") {
    const script = lines(requiredStep(named(owner, "Typecheck runtime, host, product and app")))
    assert.deepEqual(script, ["set -euo pipefail",
      ...["modules/atlas/boundary", "modules/sucafina", "packages/core", "packages/server", "packages/client", "apps/cli", "packages/app-shell"]
        .map((directory) => "(cd " + directory + " && bun run typecheck)"),
    ], "SF_CI_STATIC_OWNERSHIP: required typecheck execution changed")
  }
  if (requirement !== "typecheck") {
    const step = named(owner, "Security and dependency guards with both original and PR bases")
    const script = requiredStep(step, true)
    const environment = object(step.env, "guard environment")
    if (environment.SF_PR_BASE !== "${{ github.event.pull_request.base.sha }}" ||
      environment.GH_READ_TOKEN !== "${{ github.token }}" ||
      environment.GUARDRAIL_APPROVED !== "${{ contains(github.event.pull_request.labels.*.name, 'guardrail-approved') && 'protected-paths' || '' }}") fail("guard base or approval binding changed")
    if (createHash("sha256").update(script.replaceAll("\r\n", "\n")).digest("hex") !== GUARD_SCRIPT_SHA256) fail("reviewed guard script changed")
  }
  if (verify.if !== "always()" && verify.if !== "${{ always() }}") fail("verify must observe every conclusion")
  if (!Array.isArray(verify.needs) || !verify.needs.every((name: unknown) => typeof name === "string")) fail("verify needs missing")
  const needs = verify.needs.filter((name: unknown): name is string => typeof name === "string")
  if (needs.filter((name) => name === "static").length !== 1 || new Set(needs).size !== needs.length) fail("verify must require static exactly once")
  const precheck = named(verify, "Diagnose upstream gates before downloading suite artifacts")
  if (requiredStep(precheck).trim() !== "node script/sf-ci/gate.mjs precheck") fail("upstream precheck changed")
  const final = named(verify, "Fail closed on every missing/failed suite, skipped job or mismatched SHA")
  assert.deepEqual(lines(requiredStep(final)), [
    "set -euo pipefail",
    'test "$GITHUB_SHA" = "$(git rev-parse HEAD)"',
    'export SF_CHECKOUT_TREE_SHA="$(git rev-parse \'HEAD^{tree}\')"',
    "node script/sf-ci/gate.mjs verify",
  ], "SF_CI_STATIC_OWNERSHIP: final verification script changed")
  for (const step of [precheck, final]) {
    if (object(step.env, "verifier environment").SF_NEEDS_JSON !== "${{ toJSON(needs) }}") fail("verifier lost actual job conclusions")
  }
  // Synthetic inputs exercise the actual gate. They are not execution evidence.
  const allSuccess = Object.fromEntries(needs.map((name) => [name, { result: "success" }]))
  const admitted = prerequisite(allSuccess)
  if (typeof admitted !== "number" || admitted < 1) fail("prerequisite checker is vacuous")
  for (const result of ["failure", "cancelled", "skipped", "in_progress"]) {
    assert.throws(() => prerequisite({ ...allSuccess, static: { result } }),
      /upstream jobs not successful:.*static=/, "SF_CI_STATIC_OWNERSHIP: static " + result + " was admitted")
  }
  assert.throws(() => prerequisite(Object.fromEntries(Object.entries(allSuccess).filter(([name]) => name !== "static"))),
    /upstream jobs not successful:.*static=/, "SF_CI_STATIC_OWNERSHIP: absent static was admitted")
}
