import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createRenewalChoiceHistory } from "../wp11/renewal-choice-fixture.ts"
import { diagnosticExpected } from "./diagnostic-expected.ts"
import { composeCanonicalReadDiagnostic } from "./diagnostic-fixture.ts"
import { installCanonicalReadDiagnostic } from "./diagnostic-probe.ts"

test("measures bounded canonical C08, rule and binding work without repeating P03", async () => {
  const producerHashes = Object.fromEntries(await Promise.all(Object.entries(diagnosticExpected.producers).map(async ([path]) =>
    [path, createHash("sha256").update(new Uint8Array(await Bun.file(new URL(`../../../${path}`, import.meta.url)).arrayBuffer())).digest("hex")],
  )))
  expect(producerHashes).toEqual(diagnosticExpected.producers)
  const probe = await installCanonicalReadDiagnostic()
  let history: Awaited<ReturnType<typeof createRenewalChoiceHistory>> | undefined
  const outputs: Record<string, string> = {}
  try {
    // Clearing the spy history must preserve the original digest exception.
    expect(() => digestSfValue(() => undefined)).toThrow("SF_CANONICAL_UNSUPPORTED")
    const current = await probe.phase("prepare-once", () => createRenewalChoiceHistory({ training: "omitted" }))
    history = current
    const ports = await composeCanonicalReadDiagnostic(current, probe)
    const phase = current.before
    const context = current.fixture.context
    const comparisonRequest = { scenarioRefs: [phase.baselineRef, phase.selectedRef], criteria: ["renewal-difference"] }
    const request = { caseRef: phase.caseRef, resultRef: phase.comparisonRef }
    const stored = await probe.phase("comparison-read", () => phase.results.read({ resultRef: phase.comparisonRef, kind: "comparison" }, context))
    expect(stored.status).toBe("ok")
    if (stored.status !== "ok" || stored.value.kind !== "comparison") throw new Error("Real comparison result unavailable")
    expect(stored.value.result).toEqual(phase.comparison)
    expect(stored.value.requestDigest).toBe(digestSfValue(comparisonRequest))
    outputs.comparison = digestSfValue(stored.value)
    const rule = await probe.phase("rule-resolve", () => ports.rules.resolve({ caseRef: phase.caseRef, criterionId: "renewal-difference" }, context))
    expect(rule).toEqual({ status: "ok", value: phase.rule })
    outputs.rule = digestSfValue(rule)
    const evaluated = await probe.phase("rule-evaluate", () => ports.rules.evaluate({
      caseRef: phase.caseRef, criterionId: "renewal-difference", baselineRef: phase.baselineRef, scenarioRef: phase.selectedRef,
    }, context))
    expect(evaluated.status).toBe("ok")
    if (evaluated.status !== "ok") throw new Error("Real criterion evaluation unavailable")
    const expected = phase.comparison.criterionResults.find((value) => value.criterionId === "renewal-difference")
    expect({ state: evaluated.value.state, reason: evaluated.value.reason }).toEqual({ state: expected?.state, reason: expected?.reason })
    outputs.evaluation = digestSfValue(evaluated.value)
    const proofs = await probe.phase("binding-proofs", () => ports.bindings.proofs(phase.caseRef, comparisonRequest.criteria, context))
    expect(proofs.status).toBe("ok")
    if (proofs.status !== "ok") throw new Error("Real rule proofs unavailable")
    // The original fixture persists this comparison but no binding. Create one through
    // the real producer/CAS and canonical replay; never insert a fabricated proof.
    const bound = await probe.phase("binding-create", () => ports.bindings.bind({ ...request, request: comparisonRequest, expectedRules: proofs.value }, context))
    expect(bound.status).toBe("ok")
    if (bound.status !== "ok") throw new Error(`Real binding creation failed:${bound.reason}`)
    const binding = await probe.phase("binding-read", () => ports.bindings.read(request, context))
    expect(binding).toEqual(bound)
    outputs.binding = digestSfValue(binding)
    const again = await probe.phase("comparison-read-again", () => phase.results.read({ resultRef: phase.comparisonRef, kind: "comparison" }, context))
    expect(again).toEqual(stored)
    if (again.status !== "ok") throw new Error("Second independent C08 observation unavailable")
    expect(again.value).not.toBe(stored.value)
    outputs.comparisonAgain = digestSfValue(again.value)
    const report = probe.snapshot()
    const rows = Object.entries(report.primitives)
    // Fail closed if Bun's observer does not actually reach imported production calls.
    expect(rows.some(([key, value]) => key.includes("|digestSfValue|") && key.includes("product/decisions/result-store.ts:") && value.calls > 0)).toBe(true)
    expect(rows.some(([key, value]) => key.includes("|structuredClone|") && key.includes("product/host-binding/state-provider.ts:") && value.calls > 0)).toBe(true)
    expect(rows.some(([key, value]) => key.startsWith("binding-read|") && key.includes("|digestSfValue|") && key.includes("product/decisions/criterion-comparison.ts:") && value.calls > 0)).toBe(true)
    expect(report.pending).toBe(0)
    console.info("[canonical-read-cost]", JSON.stringify({ schema: "sf2h.canonical-read-cost.diagnostic.v1", label: diagnosticExpected.label, producerHashes, outputs,
      workload: { prepare: 1, comparisonReads: 2, ruleResolves: 1, ruleEvaluations: 1, proofReads: 1, bindingWrites: 1, bindingReads: 1 },
      boundary: "Existing renewal fixture uses synthetic source declarations and human grants; SQLite/C08/Planner/rules/metric/comparison replay/binding persistence are real. This does not execute P03, select a choice, confirm training or qualify final history/revocation.", ...report }))
  } finally {
    probe.restore()
    await history?.cleanup()
  }
}, 120000)
