import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createSfBiFactory } from "../../../product/analytics/factory.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import { createStoredScenarioBiProjection } from "../../../product/analytics/stored-scenario.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { ScenarioComparison, ScenarioResult } from "../../../product/contracts/decisions.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const caseRef = { id: "case", incarnation: "case-inc", version: 1 }
const scenario: ScenarioResult = { id: "alternative", version: 1, components: [], currency: "USD", horizon: period, sourceRefs: [], unresolvedConditions: ["training"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 210000, total: null, costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [], coverageState: "pending", entries: [], derivedMissingCategoryIds: ["training"] } }

test("stored scenario and comparison flow through one C08 projection and fail after revocation", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "bi-scenario-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const access = { allowed: true }
    const ui = createSfUiAuthority({ authorize: async () => access.allowed ? { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a" } : undefined, commandIdentity: async () => "command", createId: () => "request", now: () => Date.parse("2026-11-13T00:00:00Z") })
    const payload = { viewId: "BI09", selectionRef: "selection", period }
    const admission = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(payload))
    expect(admission.status).toBe("ok")
    if (admission.status !== "ok") return
    expect(await ui.validate(admission.value, "sf_bi_view", digestSfValue(payload))).toBe(true)
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: caseRef.incarnation }), authorize: async () => access.allowed ? { principalRef: "u", policyVersion: "v", accessRevision: "a" } : undefined })
    const source = ui.requestFor(admission.value)
    if (!source) throw new Error("request unavailable")
    const currentCase = { ...caseRef, state: "comparing", objective: "decision", currency: "USD", horizon: period, criteria: [], participants: ["u"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] } as const
    const seeded = await state.transaction(source, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "b".repeat(64), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (current) => { current.cases[caseRef.id] = currentCase; return { commit: true, value: true } })
    expect(seeded.status).toBe("ok")
    const ids = { next: 0 }
    const results = createSfDecisionResultStore({ state, host: { requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false) }, authorizeCase: async () => access.allowed, verifySources: async () => access.allowed, createId: () => `result-${++ids.next}`, now: () => "2026-11-13T00:00:00Z" })
    const savedScenario = await results.write({ kind: "scenario", result: scenario, caseRef, requestDigest: "c".repeat(64), sourceRefs: [], idempotencyKey: "scenario" }, admission.value)
    expect(savedScenario.status).toBe("ok")
    if (savedScenario.status !== "ok") return
    const comparison: ScenarioComparison = { baselineResultRef: "baseline", alternativeResultRef: savedScenario.value.resultRef, costCoverageRefs: ["coverage-ref"], criterionResults: [], unresolvedConditions: ["training"], comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null }
    const savedComparison = await results.write({ kind: "comparison", result: comparison, caseRef, requestDigest: "d".repeat(64), sourceRefs: [], idempotencyKey: "comparison" }, admission.value)
    expect(savedComparison.status).toBe("ok")
    if (savedComparison.status !== "ok") return
    const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", accessRevision: "a", policyVersion: "v", surface: "planner", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "planner", values: [], components: [], missing: [] }
    const read = createStoredScenarioBiProjection({ results, readProjection: async (selection) => selection === "selection" ? { status: "ok", value: projection } : { status: "unavailable", reason: "selection" }, revalidateProjection: async (selection, _projection, currentCase, binding) => selection.selectionRef === "selection" && currentCase.id === caseRef.id && binding.kind === "ui" && await ui.revalidate(binding) })
    const selection = { selectionRef: "selection", scenarioResultRef: savedScenario.value.resultRef, comparisonRef: savedComparison.value.resultRef }
    const result = await read(selection, admission.value)
    expect(result.status).toBe("ok")
    if (result.status === "ok") expect(result.value.decision).toEqual({ kind: "scenario", scenarioResultRef: savedScenario.value.resultRef, scenario, comparisonRef: savedComparison.value.resultRef, comparison })
    const authority: SfDomainValidation = { validateDomainContext: (binding, operation, digest) => binding.kind === "ui" ? ui.validate(binding, operation, digest) : Promise.resolve(false), revalidateDomainContext: (binding) => binding.kind === "ui" ? ui.revalidate(binding) : Promise.resolve(false), receiptFor: (binding, operation, digest, resultDigest) => binding.kind === "ui" ? ui.receiptFor(binding, operation, digest, resultDigest) : undefined }
    const factory = createSfBiFactory({ authority, scenario: { views: ["BI09", "BI11"], host: { readProjection: read, resolve: async () => ({ status: "ok", value: { scenarioResultRef: selection.scenarioResultRef, comparisonRef: selection.comparisonRef, present: () => ({ viewId: "BI09", series: [], limitations: [] }) } }), revalidate: (_request, binding) => authority.revalidateDomainContext(binding) } } })
    const shown = await factory.readPresentation(payload, admission.value)
    expect(shown.status).toBe("ok")
    const next = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(payload))
    expect(next.status).toBe("ok")
    if (next.status !== "ok") return
    const dispatched = await dispatchSfCapability({ operation: "sf_bi_view", payload, context: next.value, descriptors: [factory.descriptor], authority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_bi_view", value).ok, validateOutput: (_descriptor, output) => output.status !== "ok" || decodeSfOperationOutput("sf_bi_view", output.result).ok })
    expect(dispatched.status).toBe("ok")
    if (dispatched.status === "ok" && shown.status === "ok") expect(dispatched.result).toEqual(shown.value.projection)
    expect((await factory.source.read({ ...payload, viewId: "BI11" }, admission.value)).status).toBe("unavailable")
    const sample = { scenarioRef: savedScenario.value.resultRef, parameterRef: "training", bounds: { minimum: 0, maximum: 10, steps: 1 }, evaluated: [], threshold: null, thresholdEvidence: { state: "unavailable" as const, reason: "not-evaluated" }, unit: "USD", parameterUnit: "USD", resultUnit: "USD", engineVersion: "planner", costCoverageRefs: ["coverage-ref"], comparisonStatus: "conditioned" as const, unresolvedConditions: [], evidenceRefs: [] }
    const sensitivityReads = { count: 0, changed: false }
    const sensitivityReader = createStoredScenarioBiProjection({ results, readProjection: async () => ({ status: "ok", value: projection }), revalidateProjection: async (_selection, _projection, _case, binding) => binding.kind === "ui" && await ui.revalidate(binding), readSensitivity: async (reference) => { sensitivityReads.count++; return { status: "ok", value: { sensitivityResultRef: reference, sensitivity: { ...sample, parameterRef: sensitivityReads.changed && sensitivityReads.count % 2 === 0 ? "other" : "training" }, caseRef } } } })
    const selectedSensitivity = { ...selection, sensitivityResultRef: "sensitivity-ref" }
    const withSensitivity = await sensitivityReader(selectedSensitivity, admission.value)
    expect(withSensitivity.status).toBe("ok")
    if (withSensitivity.status === "ok" && withSensitivity.value.decision?.kind === "scenario") {
      expect("sensitivityResultRef" in withSensitivity.value.decision && withSensitivity.value.decision.sensitivityResultRef).toBe("sensitivity-ref")
      expect(withSensitivity.value.decision.sensitivity).toEqual(sample)
    }
    sensitivityReads.changed = true
    expect(await sensitivityReader(selectedSensitivity, admission.value)).toEqual({ status: "stale", reason: "scenario-or-projection-changed" })
    const differentScenario = await results.write({ kind: "scenario", result: { ...scenario, id: "different" }, caseRef, requestDigest: "e".repeat(64), sourceRefs: [], idempotencyKey: "different-scenario" }, admission.value)
    expect(differentScenario.status).toBe("ok")
    if (differentScenario.status === "ok") expect(await read({ ...selection, scenarioResultRef: differentScenario.value.resultRef }, admission.value)).toEqual({ status: "stale", reason: "scenario-reference-mismatch" })
    expect((await read({ ...selection, scenarioResultRef: "missing" }, admission.value)).status).toBe("unavailable")
    access.allowed = false
    expect((await read(selection, admission.value)).status).toBe("denied")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
